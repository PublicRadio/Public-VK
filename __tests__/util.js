jest.autoMockOff()
const {encodeToSearchString} = require('../lib/util.js')
jest.autoMockOn()

describe('Utility functions', () => {
    describe('encodeToSearchString', () => {
        it('should encode JSON with string', () => {
            expect('foo=bar').toEqual(encodeToSearchString({foo: 'bar'}))
        })
        it('should encode JSON with multiple strings ordered by key name', () => {
            expect('bar=baz&foo=bar').toEqual(encodeToSearchString({foo: 'bar', bar: 'baz'}))
        })
        it('should encode JSON with numbers and booleans', () => {
            expect('foo=1').toEqual(encodeToSearchString({foo: 1}))
            expect('foo=true').toEqual(encodeToSearchString({foo: true}))
        })
    })
})