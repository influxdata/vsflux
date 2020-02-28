import { describe, it } from 'mocha'
import expect from 'expect'

import * as fs from 'fs'

import { queryResponseToTableResult } from '../components/Query'

describe('transform query results', () => {
  it('returns a proper table result', () => {
    const contents = fs.readFileSync(
      `${__dirname}/../../src/test/fixtures/results.csv`, { encoding: 'utf8' }
    )
    const results = queryResponseToTableResult(contents)

    expect(results[0].head[0]).toEqual('_start')
    expect(results[0].rows.length).toEqual(9)
    expect(results[1].head[0]).toEqual('_start')
    expect(results[1].rows.length).toEqual(1)
    expect(results.length).toEqual(2)
  })
})
