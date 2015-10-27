import fetch from 'isomorphic-fetch'


function executeRemoteCodeByUrl(src) {
    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.src = src
    document.head.appendChild(script)
}

function encodeToSearchString(options) {
    return Object.keys(options)
        .filter(key => key && options[key])
        .reduce((string, key) => string + '&' + `${key}=${encodeURIComponent(options[key])}`, '').slice(1)
}

class Query {
    static v = '5.25';

    constructor(method, opts = {}, postfix = '') {Object.assign(this, {method, opts: {v: Query.v, ...opts}, postfix})}
}

class QueryRunner {
    static spliceSizeLowThreshold = 4;
    static spliceSizeHighThreshold = 25;
    static basePath = 'https://api.vk.com/method';

    static generateExecuteCode(queries) {
        return 'var results = [], result;' +
            queries
                .map(q => ({
                    call: `API.${q.method}(${JSON.stringify(q.opts, (key, value) => typeof value === 'string'
                        ? value.replace(/[^\\]('")/img, "\$1").replace(/&/img, '')
                        : value)})`,
                    postfix: q.postfix
                }))
                .map(q => q.postfix
                    ? `result = ${q.call}${q.postfix};results.push(result);`
                    : `results.push(${q.call});`)
                .join('\n') +
            `return results;`
    }

    spliceSize = QueryRunner.spliceSizeHighThreshold;
    stack = [];
    _loopRunning = false;


    addQuery(query) {
        return new Promise(resolve => {
            this.stack.push(Object.assign(query, {resolve}))
            this.startLoop()
        })
    }

    /** @private */
    removeQueryFromStack(query) {
        this.stack.splice(this.stack.indexOf(query), 1)
    }

    /** @private */
    getNextQuery() {
        if (this.stack.length === 0) {}
        else if (!this.access_token) {
            for (let query of this.stack)
                if (query.method !== 'execute') {
                    this.removeQueryFromStack(query)
                    return query
                }
        }
        else if (this.stack[0].method === 'execute') {
            const query = this.stack[0]
            this.removeQueryFromStack(query)
            return query
        }
        else {
            const aggregatedQueryStack = []
            for (let query of this.stack) if (query.method !== 'execute') {
                aggregatedQueryStack.push(query)
                if (aggregatedQueryStack.length >= this.spliceSize)
                    break
            }

            for (let query of aggregatedQueryStack)
                this.removeQueryFromStack(query)

            return Object.assign(new Query('execute', {code: QueryRunner.generateExecuteCode(aggregatedQueryStack)}),
                {
                    resolve({response}) {
                        for (var i = 0; i < response.length; i++)
                            aggregatedQueryStack[i].resolve(response[i])
                    }
                })
        }
    }

    /** @private */
    startLoop() {
        if (!this._loopRunning)
            this.runLoop()
    }

    /** @private */
    processError(error) {
        console.warn(error)
        //todo
    }

    /** @private */
    async runLoop() {
        let query
        while (query = this.getNextQuery()) {
            const result = await this.executeQuery(query)
            result === undefined ? this.addQuery(query) : query.resolve(result)
            /*FILO stack*/
        }
    }

    /** @private */
    executeQuery(query) {
        return fetch(`${QueryRunner.basePath}/${query.method}?` +
            encodeToSearchString(this.access_token ? {...query.opts, access_token: this.access_token} : query.opts))
            .then(response => response.json())
            .then(({error, ...response} = {error: true}) => error ? Promise.reject(error) : response)
            .catch(error => {
                this.processError(error)
                return undefined
            })
    }
}

export class VK {
    static loginBasePath = 'https://login.vk.com/?';
    queryRunner = new QueryRunner();

    static registerAuthStatusCallback(cb) {
        if (!window.VK) {
            window.VK = {Auth: {lsCb: [cb]}}
            return 0
        } else if (window.VK instanceof Object && window.VK.Auth && window.VK.Auth.lsCb) {
            let key = 0
            do key++
            while (window.VK.Auth.lsCb.hasOwnProperty(String(key)))
            window.VK.Auth.lsCb[key] = cb
            return key
        } else {
            console.error('window.VK object is mocked with', window.VK)
            throw new Error('window.VK object is invalid')
        }
    }

    constructor(application_id) {Object.assign(this, {application_id})}

    call(method, opts = {}, postfix = '') {
        return this.queryRunner.addQuery(new Query(method, opts, postfix))
    }

    getLoginStatus() {
        return new Promise(res => VK.registerAuthStatusCallback(res))
            .then(rnd => this._executeOpenapiRequest({rnd}))
    }


    async login(permissions) {
        const popup = window.open(`https://oauth.vk.com/authorize?client_id=${this.application_id}&display=popup&redirect_uri=close.html&response_type=token&scope=${permissions}`, 'vk_auth', 'width=500,height=500')
        if (!popup) throw new Error('cannot open popup')
        while (popup.parent)
            await new Promise(res => {setTimeout(res, 100)})
        const {user, access_token, sig, secret, expire} = await this.getLoginStatus()
        this.queryRunner.access_token = access_token
        Object.assign(this, {user, access_token, sig, secret, expire})
    }

    logout() {
        if (!this.sig)
            return
        this._executeOpenapiRequest({do_logout: 1, token: this.sig})
        this.queryRunner.access_token = undefined
        Object.assign(this, {user: null, access_token: null, sig: null, secret: null, expire: null})
        document.cookie = `vk_app_${this.application_id}=; expires=Thu, 01 Jan 1970 00:00:01 GMT;`
    }

    _executeOpenapiRequest(opts) {
        executeRemoteCodeByUrl(VK.loginBasePath + '?' + encodeToSearchString({
                act: 'openapi',
                oauth: 1,
                aid: this.application_id,
                location: encodeURIComponent(window.location.hostname),
                ...opts
            }))
    }
}