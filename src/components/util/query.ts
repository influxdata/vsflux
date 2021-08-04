export const EmptyTableResult = { head: [], rows: [] }

export interface QueryResult {
    tables : TableResult[],
    raw : string,
}

export type Rows = string[][];

export interface TableResult {
    head : string[];
    rows : Rows;
}

export function queryResponseToTableResult(body : string) : TableResult[] {
    const accum : TableResult[] = []
    return body
        .split(/\r?\n\r?\n/)
        .filter((v) => v) // kill the blank lines
        .reduce((acc, group) => {
            const rows = group.split('\n').filter((v) => !v.startsWith('#') && v)
            const result : TableResult = {
                head: rows[0].split(',').slice(2).map((v) => v.trim()),
                rows: rows.slice(1).map((v) => v.split(',').slice(2).map((v) => v.trim()))
            }
            acc.push(result)
            return acc
        }, accum)
}
