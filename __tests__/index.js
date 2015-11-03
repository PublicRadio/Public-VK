jest.autoMockOff()
jest.dontMock('babel/polyfill')
require('babel/polyfill')
jest.autoMockOn()
jest.dontMock('../lib/index.js')
jest.dontMock('../lib/QueryRunner.js')
jest.dontMock('../lib/util.js')

const fetch = jest.genMockFn()
jest.setMock('isomorphic-fetch', fetch)

const {VK} = require('../lib/index.js')
const {Query} = require('../lib/QueryRunner.js')

const jsonContents = JSON.stringify({v: Query.v})
const app_id = 12345
const sid = app_id

const getLastFetchCall = () => fetch.mock.calls[fetch.mock.calls.length - 1]
const expectLastFetchCall = () => expect(getLastFetchCall()[0])
const mockResponseWithJson = (response = '') => {
    const json = jest.genMockFn()
    fetch.mockReturnValue(Promise.resolve({json}))
    json.mockReturnValue(Promise.resolve({response}))
}
const checkExecuteCall = (queryString) =>
    expectLastFetchCall()
        .toEqual('https://api.vk.com/method/execute?' +
            'access_token=' + app_id +
            '&code=' +
            encodeURIComponent('var results=[],result;' + queryString + 'return results;') +
            '&v=' + Query.v)

describe('VK Api', () => {
    describe('unauthorized instance', () => {
        const vk = new VK(app_id)
        it('should perform non-authenticated call to VK', () => {
            vk.call('foo', {bar: 'baz'})
            jest.runAllTimers()
            expectLastFetchCall().toEqual('https://api.vk.com/method/foo?bar=baz&v=' + Query.v)
        })
        it('should pass the response', () => {
            mockResponseWithJson({a: 'b'})
            vk.call('')
                .then(result => expect(result.a).toEqual('b'))
            jest.runAllTicks()
            jest.runAllTimers()
        })
    })
    describe('authorized instance', () => {
        it('should perform authenticated call to VK', () => {
            Object.assign(new VK(app_id), {sid}).call('')
            jest.runAllTimers()
            expectLastFetchCall().toEqual('https://api.vk.com/method/?access_token=' + sid + '&v=' + Query.v)
        })
    })
    describe('bunched calls', () => {
        const vk = new VK(app_id)
        vk.sid = app_id

        it('should merge multiple requests', () => {
            vk.call('1', {})
            vk.call('2', {})
            const jsonContents = JSON.stringify({v: Query.v})
            jest.runAllTimers()
            checkExecuteCall(
                'results.push(API.1(' + jsonContents + '));' +
                'results.push(API.2(' + jsonContents + '));')
        })
        it('should merge multiple requests with simple postfixes', () => {
            vk.call('1', {}, '.1')
            vk.call('2', {}, '.2')
            jest.runAllTimers()
            checkExecuteCall(
                'results.push(API.1(' + jsonContents + ').1);' +
                'results.push(API.2(' + jsonContents + ').2);')
        })
        it('should merge multiple requests with postfixes including ";" in a complex manner', () => {
            vk.call('1', {}, '; result = 1')
            vk.call('2', {}, '; result = 2')
            jest.runAllTimers()
            checkExecuteCall(
                'result = API.1(' + jsonContents + '); result = 1;' +
                'results.push(result);' +
                'result = API.2(' + jsonContents + '); result = 2;' +
                'results.push(result);')
        })
        it('should take a break if have more than 25 reqs', () => {
            let i = 0
            while (i++ < 45) vk.call('')
            const response = []
            while (response.length < 25)
                response.push('')
            const json = jest.genMockFn()
            fetch.mockReturnValue(Promise.resolve({json}))
            json.mockReturnValue(Promise.resolve({response}))

            const initialFetchCallsLength = fetch.mock.calls.length
            jest.runAllTimers()
            expect(fetch.mock.calls.length - initialFetchCallsLength).toEqual(2)
        })
    })
})