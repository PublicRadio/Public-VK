try {
    require('babel/polyfill')
} catch (e) {}
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
    static localStorageKey = '__publicVkApi_sid';

    queryRunner = new QueryRunner();
    application_id;
    //noinspection JSDuplicatedDeclaration
    sid = (new RegExp(`(?:^|;) *${VK.localStorageKey}=([^;]+) *(?:;|$)`, 'img').exec(document.cookie) || [])[1];
    //noinspection JSDuplicatedDeclaration

    /**
     * VK Constructor
     * @constructs VK
     * @param {number} application_id
     */
    constructor(application_id) {
        this.application_id = application_id
        this.getLoginStatus({new: 1})
    }

    //noinspection JSDuplicatedDeclaration
    /** @private */
    get sid() {return this._sid}

    //noinspection JSDuplicatedDeclaration
    /** @private */
    set sid(val) {this.queryRunner.access_token = this._sid = val}

    /** @private */
    getLoginStatus(opts) {
        const req = fetch('https://login.vk.com/?' +
            encodeToSearchString({
                location: encodeURIComponent(window.location.hostname),
                act: 'openapi',
                oauth: 1,
                aid: this.application_id,
                ...opts
            }), {credentials: 'include'})
            .then(res => res.json())
        req.then(({expire, sid, user}) => {
            this.sid = sid
            this.user = user
            const expireDate = new Date(Number(expire) * 1000)
            document.cookie = `${VK.localStorageKey}=${sid || ''};expires=${expireDate.toString()}`;
            clearTimeout(this.__updateTimeout)
            this.__updateTimeout = setTimeout(() => this.getLoginStatus({new: 1}), Number(expireDate) - Date.now())
        });
        return req
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
        await this.getLoginStatus({new: 1})
    }

    /**
     * @method logout
     * De-authenticates the user
     * */
    logout() {
        if (!this.sid) return
        fetch('https://login.vk.com/?' +
            encodeToSearchString({
                location: encodeURIComponent(window.location.hostname),
                token: this.sid,
                do_logout: 1,
                act: 'openapi',
                oauth: 1,
                aid: this.application_id
            }), {credentials: 'include'})
        Object.assign(this, {user: null, sid: null, secret: null, expire: null})
        document.cookie = `vk_app_${this.application_id}=; expires=Thu, 01 Jan 1970 00:00:01 GMT;`
    }
}