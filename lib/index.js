import {Query,QueryRunner} from './QueryRunner'
import {encodeToSearchString} from './util'

function executeRemoteCodeByUrl(src) {
    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.src = src
    document.head.appendChild(script)
}


export class VK {
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

    queryRunner = new QueryRunner();
    application_id;
    sig;

    constructor(application_id) {
        this.application_id = application_id
        this.call = this.queryRunner.addQuery.bind(this.queryRunner)
        this.openapiRequest = opts => executeOpenapiRequest(opts, this.application_id)
    }

    get sid() {return this._sid}

    set sid(val) {this.queryRunner.access_token = this._sid = val}

    getLoginStatus() {return new Promise(res => this.openapiRequest({rnd: VK.registerAuthStatusCallback(res)}))}

    async login(scope) {
        const popup = window.open('https://oauth.vk.com/authorize?' + encodeToSearchString({
                client_id: this.application_id,
                display: 'popup',
                redirect_uri: 'close.html',
                response_type: 'token',
                scope
            }),
            'vk_auth',
            'width=500,height=500')
        if (!popup) throw new Error('cannot open popup')
        while (popup.parent)
            await new Promise(res => {setTimeout(res, 100)})
        const {user, sig, secret, expire} = await this.getLoginStatus()
        Object.assign(this, {user, sig, secret, expire})
    }

    logout() {
        if (!this.sig) return
        this.openapiRequest({do_logout: 1, token: this.sig})
        Object.assign(this, {user: null, sig: null, secret: null, expire: null})
        document.cookie = `vk_app_${this.application_id}=; expires=Thu, 01 Jan 1970 00:00:01 GMT;`
    }
}

function executeOpenapiRequest(opts, aid) {
    const act = 'openapi'
    const oauth = 1
    executeRemoteCodeByUrl('https://login.vk.com/?' +
        encodeToSearchString({location: encodeURIComponent(window.location.hostname), act, oauth, aid, ...opts}))
}