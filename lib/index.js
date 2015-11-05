import 'babel/polyfill'
import fetch from 'isomorphic-fetch'
import {Query,QueryRunner} from './QueryRunner'
import {encodeToSearchString} from './util'

/**
 * Universal VK browser interface
 * provides login, logout and call interfaces
 * @class VK
 *
 * @method VK.login
 * @method VK.logout
 * */
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

    /**
     * VK Constructor
     * @constructs VK
     * @param application_id
     */
    constructor(application_id) {
        this.application_id = application_id
    }

    /** @private */
    get sid() {return this._sid}

    /** @private */
    set sid(val) {this.queryRunner.access_token = this._sid = val}

    /** @private */
    getLoginStatus(opts) {
        return fetch('https://login.vk.com/?' +
            encodeToSearchString({
                location: encodeURIComponent(window.location.hostname),
                act: 'openapi',
                oauth: 1,
                aid: this.application_id,
                ...opts
            }), {credentials: 'include'})
            .then(res => res.json())
    }

    /**
     * VK Api request smart wrapper
     * @param {string} method - request method name
     * @param {object=} opts - request opts
     * @param {string=} postfix - optional reducer for "execute" method
     * */
    call(method, opts, postfix) {
        return this.queryRunner.addQuery(method, opts, postfix)
    }

    /**
     * @method login
     * Opens the auth popup
     * @arg scope Permission scope required by the project
     * */
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
        const {user, sig, secret, expire} = await this.getLoginStatus({new: 1})
        Object.assign(this, {user, sig, secret, expire})
    }

    /**
     * @method logout
     * De-authenticates the user
     * */
    logout() {
        if (!this.sig) return
        fetch('https://login.vk.com/?' +
            encodeToSearchString({
                location: encodeURIComponent(window.location.hostname),
                token: this.sig,
                do_logout: 1,
                act: 'openapi',
                oauth: 1,
                aid: this.application_id
            }), {credentials: 'include'})
        Object.assign(this, {user: null, sig: null, secret: null, expire: null})
        document.cookie = `vk_app_${this.application_id}=; expires=Thu, 01 Jan 1970 00:00:01 GMT;`
    }
}