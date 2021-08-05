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
            const rows = group.trim().split('\n').filter((v) => !v.startsWith('#') && v)
            let slice_start = 2
            const keys = rows[0].split(',')
            if (keys[1] == "error") {
                slice_start = 1
            }
            const result : TableResult = {
                head: rows[0].split(',').slice(slice_start).map((v) => v.trim()),
                rows: rows.slice(1).map((v) => v.split(',').slice(slice_start).map((v) => v.trim()))
            }
            acc.push(result)
            return acc
        }, accum)
}
