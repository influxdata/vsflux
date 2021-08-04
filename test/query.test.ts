import { describe, it } from 'mocha'
import expect from 'expect'

import * as fs from 'fs'

import { queryResponseToTableResult } from '../src/components/util/query'

describe('transform query results', () => {
  it('returns a proper table result', () => {
    const contents = fs.readFileSync(
      `${__dirname}/fixtures/results.csv`, { encoding: 'utf8' }
    )
    const results = queryResponseToTableResult(contents)
    const [first, second] = results

    expect(first.head[0]).toEqual('table')
    expect(first.rows.length).toEqual(9)
    expect(second.head[0]).toEqual('table')
    expect(second.rows.length).toEqual(1)
    expect(results.length).toEqual(2)
  })
})
