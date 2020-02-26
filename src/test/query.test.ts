import { describe, it } from 'mocha'
import expect from 'expect'

import * as fs from 'fs'

import { queryResponseToTableResult } from '../components/Query'

describe('transform query results', () => {
  it('returns a proper table result', () => {
    const contents = fs.readFileSync(`${__dirname}/../../src/test/fixtures/results.csv`, { encoding: 'utf8' })

    const result = queryResponseToTableResult(contents)

    expect(result.head[0]).toEqual('_start')
    expect(result.rows.length).toEqual(2)
  })
})
