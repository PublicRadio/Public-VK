import fetch from 'isomorphic-fetch'
import {encodeToSearchString} from './util'

export class Query {
    static v = '5.25';

    constructor(method, opts = {}, {postfix = '', resolve = () => {}}) {
        Object.assign(this, {method, opts: {v: Query.v, ...opts}, postfix})
    }
}

const stringifyOpts = opts => JSON.stringify(opts, (key, value) => typeof value === 'string'
    ? value.replace(/[^\\]('")/img, "\$1").replace(/&/img, '')
    : value)

function generateExecuteCode(queries) {
    return 'var results=[],result;' +
        queries
            .map(({method, opts, postfix = ''}) => {
                const optsString = stringifyOpts(opts)
                const call = `API.${method}(${optsString})${postfix}`
                const needCompactSyntax = !postfix || (postfix.indexOf(';') === -1)
                return needCompactSyntax
                    ? `results.push(${call});`
                    : `result = ${call};results.push(result);`;
            })
            .join('') +
        `return results;`
}

export class QueryRunner {
    static spliceSizeLowThreshold = 4;
    static spliceSizeHighThreshold = 25;
    static queryInterval = 350;
    static basePath = 'https://api.vk.com/method';


    spliceSize = QueryRunner.spliceSizeHighThreshold;
    stack = [];
    _loopRunning = false;

    addQuery(method, opts, postfix) {
        return new Promise(resolve => {
            this.stack.push(new Query(method, opts, {postfix, resolve}))
            setTimeout(() => this.startLoop(), 0)
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
            const queryStack = []
            for (let query of this.stack) if (query.method !== 'execute') {
                queryStack.push(query)
                if (queryStack.length >= this.spliceSize)
                    break
            }

            for (let query of queryStack)
                this.removeQueryFromStack(query)

            if (queryStack.length === 1)
                return queryStack[0]
            else
                return new Query('execute', {code: generateExecuteCode(queryStack)}, {
                    resolve({response}) {response.forEach((response, idx) => queryStack[idx].resolve(response))}
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
        const query = this.getNextQuery()
        if (query) {
            setTimeout(() => this.runLoop(), QueryRunner.queryInterval)
            fetch(`${QueryRunner.basePath}/${query.method}?` +
                encodeToSearchString(this.access_token ? {...query.opts, access_token: this.access_token} : query.opts))
                .then(response => response.json())
                .then((response = {error: 'fetch error'}) => response.error ? Promise.reject(response.error) : response)
                .then(
                    result => query.resolve(result.response),
                    (error) => {
                        this.processError(error)
                        this.addQuery(query)
                    })

        } else {
            this._loopRunning = false
        }
    }
}
