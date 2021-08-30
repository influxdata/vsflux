import { FluxTableColumn, FluxTableMetaData, QueryApi } from '@influxdata/influxdb-client'

type TableHead = FluxTableColumn[]
type TableRow = string[]

class TableResult {
    public rows : TableRow[] = []

    constructor(
        readonly head : TableHead,
        firstRow : TableRow,
    ) {
        this.rows.push(firstRow)
    }

    public push(row : TableRow) {
        this.rows.push(row)
    }
}

export class QueryResult {
    readonly tables : TableResult[] = []

    public push(result : TableResult) {
        this.tables.push(result)
    }

    static async run(client : QueryApi, query : string) : Promise<QueryResult> {
        const result = new QueryResult()
        let currentTableId = -1
        let currentTableResult : TableResult
        return new Promise((resolve, reject) => {
            client.queryRows(query, {
                next(row : string[], tableMeta : FluxTableMetaData) {
                    const idColumn = tableMeta.column("table")
                    const idIndex = tableMeta.columns.indexOf(idColumn)
                    if (currentTableId !== parseInt(row[idIndex])) {
                        if (currentTableResult !== undefined) {
                            result.push(currentTableResult)
                        }
                        // Copy the columns so there isn't a circular dependency.
                        const columns = tableMeta.columns.map((x => Object.assign({}, x)))
                        currentTableResult = new TableResult(columns, row)
                    } else {
                        currentTableResult.push(row)
                    }
                },
                error(error : Error) {
                    reject(error)
                },
                complete() {
                    // The last row doesn't know it's the last row, so
                    // add the last table result, if there are any.
                    if (currentTableResult !== undefined) {
                        result.push(currentTableResult)
                    }
                    resolve(result)
                }
            })
        })
    }
}