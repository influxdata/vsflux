import { FluxTableColumn, FluxTableMetaData, QueryApi } from '@influxdata/influxdb-client'

type TableHead = FluxTableColumn[]
type TableRow = string[]

class TableResult {
    public rows : TableRow[] = []

    constructor(
        readonly head : TableHead,
        firstRow : TableRow
    ) {
        this.push(firstRow)
    }

    public push(row : TableRow) : void {
        // The "_result" column doesn't have the default populated by the client.
        if (row[0] == "" && this.head[0].defaultValue != undefined) {
            row[0] = this.head[0].defaultValue
        }
        this.rows.push(row)
    }
}

export class QueryResult {
    readonly tables : TableResult[] = []

    public push(result : TableResult) : void {
        this.tables.push(result)
    }

    static async run(client : QueryApi, query : string) : Promise<QueryResult> {
        const result = new QueryResult()
        let currentTableId = -1
        let currentTableResult : TableResult
        return new Promise((resolve, reject) => {
            client.queryRows(query, {
                next(row : string[], tableMeta : FluxTableMetaData) {
                    const idColumn = tableMeta.column('table')
                    const idIndex = tableMeta.columns.indexOf(idColumn)
                    const rowTableId = parseInt(row[idIndex])
                    if (currentTableId !== rowTableId) {
                        console.log(`Old id is ${currentTableId} and new id is ${parseInt(row[idIndex])}`)
                        if (currentTableResult !== undefined) {
                            // "Complete" the table by pushing it on to the result list before creating a new
                            // table.
                            result.push(currentTableResult)
                        }
                        // Copy the columns so there isn't a circular dependency.
                        const columns = tableMeta.columns.map(x => Object.assign({}, x))
                        currentTableResult = new TableResult(columns, row)
                        currentTableId = rowTableId
                    } else {
                        console.log("pushing row to existing table")
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
