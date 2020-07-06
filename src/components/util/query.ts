export const EmptyTableResult = { head: [], rows: [] }

export interface V1Result {
  series: Array<V1Row>;
  error: string;
}

export interface V1Row {
  columns: Array<string>;
  values: Array<Array<string>>;
}

export interface QueryResult {
  tables: TableResult[],
  raw: string,
}

export type Rows = string[][];

export interface TableResult {
  head: string[];
  rows: Rows;
}

export function queryResponseToTableResult (body: string): TableResult[] {
  const accum: TableResult[] = []
  return body
    .split(/\r?\n\r?\n/)
    .filter((v) => v) // kill the blank lines
    .reduce((acc, group) => {
      const rows = group.split('\n').filter((v) => !v.startsWith('#') && v)
      const result: TableResult = {
        head: rows[0].split(',').slice(3),
        rows: rows.slice(1).map((v) => v.split(',').slice(3))
      }
      acc.push(result)
      return acc
    }, accum)
}

export function v1QueryResponseToTableResult (body: {
  results: V1Result[];
}): TableResult[] {
  const results: Array<V1Result> = body.results

  if (results.length === 0) {
    return [EmptyTableResult]
  }

  if (results[0]?.error) {
    throw new Error(results[0].error)
  }
  const tableResults: TableResult[] = []

  results[0].series.forEach((result) => {
    tableResults.push({
      head: result.columns,
      rows: result.values
    })
  })

  return tableResults
}
