jest.autoMockOff()
jest.dontMock('babel/polyfill')
require('babel/polyfill')
jest.autoMockOn()
jest.dontMock('../lib/index.js')
jest.dontMock('../lib/QueryRunner.js')
jest.dontMock('../lib/util.js')

const fetch = jest.genMockFn()
jest.setMock('isomorphic-fetch', fetch)
const getLastFetchCall = () => fetch.mock.calls[fetch.mock.calls.length - 1]

const {VK} = require('../lib/index.js')
const {Query} = require('../lib/QueryRunner.js')

describe('VK Api', () => {
    const app_id = 12345
    describe('unauthorized instance', () => {
        const vk = new VK(app_id)
        it('should perform non-authenticated call to VK', () => {
            vk.call('foo', {bar: 'baz'})
            jest.runAllTimers()
            expect(getLastFetchCall()[0]).toEqual('https://api.vk.com/method/foo?bar=baz&v=' + Query.v)
        })
        it('should pass the response', () => {
            const json = jest.genMockFn()
            fetch.mockReturnValue(Promise.resolve({json}))
            json.mockReturnValue(Promise.resolve({response: {a: 'b'}}))

            vk.call('')
                .then(result => expect(result.a).toEqual('b'))
            jest.runAllTicks()
            jest.runAllTimers()
        })
    })
    describe('authorized instance', () => {
        const vk = new VK(app_id)
        vk.sid = app_id
        it('should perform authenticated call to VK', () => {
            vk.call('', {})
            jest.runAllTimers()
            expect(getLastFetchCall()[0]).toEqual('https://api.vk.com/method/?access_token=' + app_id + '&v=' + Query.v)
        })
        it('should merge multiple requests', () => {
            vk.call('1', {})
            vk.call('2', {})
            const jsonContents = JSON.stringify({v: Query.v})
            jest.runAllTimers()
            expect(getLastFetchCall()[0]).toEqual('https://api.vk.com/method/execute?' +
                'access_token=' + app_id +
                '&code=' +
                encodeURIComponent('var results=[],result;' +
                    'results.push(API.1('+jsonContents+'));' +
                    'results.push(API.2('+jsonContents+'));' +
                    'return results;') +
                '&v=' + Query.v)
        })
    })
})