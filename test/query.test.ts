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

    expect(first.head).toEqual(['table', '_start', '_stop', '_time', '_value', '_field', '_measurement', 'host', 'name'])
    expect(first.rows.length).toEqual(9)
    expect(second.head).toEqual(['table', '_start', '_stop', '_time', '_value', '_field', '_measurement', 'host'])
    expect(second.rows.length).toEqual(1)
    expect(results.length).toEqual(2)
  })

  it('handles error tables properly', () => {
    const contents = fs.readFileSync(
      `${__dirname}/fixtures/error.csv`, { encoding: 'utf8' }
    )
    const results = queryResponseToTableResult(contents)
    const [first, second] = results

    expect(first.head).toEqual(['table', 'url'])
    expect(first.rows).toEqual([['0', 'not_gonna_work.bar']])
    expect(second.head).toEqual(['error', 'reference'])
    expect(second.rows).toEqual([['"runtime error @18:4-18:60: map: failed to evaluate map function: Post ""not_gonna_work.bar"": unsupported protocol scheme """""', '']])
  })
})
