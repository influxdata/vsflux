import { AnnotatedCSVResponse, FluxResultObserver, FluxTableColumn, FluxTableMetaData, QueryApi } from '@influxdata/influxdb-client'

type TableHead = FluxTableColumn[]
type TableRow = string[]

class TableResult {
    public rows : TableRow[] = []
    private result : string

    constructor(
        readonly head : TableHead,
        firstRow : TableRow
    ) {
        this.result = this.head[0].defaultValue
        this.head.shift()
        this.push(firstRow)
    }

    public push(row : TableRow) : void {
        // Remove the empty "_result" column. We can get that data
        // from the table head.
        row.shift()
        this.rows.push(row)
    }
}

export class QueryResult {
    readonly tables : TableResult[] = []

    public push(result : TableResult) : void {
        this.tables.push(result)
    }

    static async run(client : QueryApi, query : string) : Promise<QueryResult> {
        return new Promise((resolve, reject) => {
            client.queryRows(query, queryResultObserver(resolve, reject))
        })
    }

    static async parseCSVResponse(response : AnnotatedCSVResponse) : Promise<QueryResult> {
        return new Promise((resolve, reject) => {
            response.consumeRows(queryResultObserver(resolve, reject))
        })
    }
}

function queryResultObserver(resolve : (result : QueryResult | PromiseLike<QueryResult>) => void, reject : (reason ?: Error) => void) : FluxResultObserver<string[]> {
    const result = new QueryResult()
    let currentSchema : FluxTableMetaData
    let currentTableResult : TableResult
    return {
        next(row : string[], tableMeta : FluxTableMetaData) {
            if (currentSchema !== tableMeta) {
                if (currentTableResult !== undefined) {
                    // "Complete" the table by pushing it on to the result list before creating a new
                    // table.
                    result.push(currentTableResult)
                }
                // Copy the columns so there isn't a circular dependency.
                const columns = tableMeta.columns.map(x => Object.assign({}, x))
                currentTableResult = new TableResult(columns, row)
                currentSchema = tableMeta
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
    }
}
