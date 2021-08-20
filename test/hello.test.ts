import { describe, it } from 'mocha'
import expect from 'expect'

describe('this test', () => {
    it('says hello', () => {
        const text = 'hello world'

        expect(text).toEqual('hello world')
    })
})