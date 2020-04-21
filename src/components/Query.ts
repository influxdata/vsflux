import { ExtensionContext, window } from 'vscode'
import {
  InfluxDBConnection,
  InfluxConnectionVersion
} from './connections/Connection'
import { TableResult, TableView, EmptyTableResult } from './TableView'
import { Status } from './connections/Status'
import axios from 'axios'

import { logger } from '../util'

export class Engine {
  public constructor () {}
}

export class ViewEngine extends Engine {
  private tableView: TableView;

  public constructor (context: ExtensionContext) {
    super()
    this.tableView = new TableView(context)
  }

  public async TableView (connection?: InfluxDBConnection, query?: string) {
    const { activeTextEditor } = window

    if (!query && !activeTextEditor) {
      return window.showWarningMessage('No Flux file selected')
    }

    connection = connection || Status.Current

    if (!connection) {
      window.showWarningMessage('No influxDB Server selected')
      return
    }

    if (!query && activeTextEditor) {
      if (activeTextEditor.selection.isEmpty) {
        query = activeTextEditor.document.getText()
      } else {
        query = activeTextEditor.document.getText(activeTextEditor.selection)
      }
    }

    query = query || ''

    logger.log(`Running Query: '${query}'`)
    logger.show()

    try {
      const results = await APIRequest.queryV2(connection, query)
      return this.tableView.show(results, connection.name)
    } catch (e) {
      logger.log(e.toString())
    }
  }
}

export class Queries {
  public static async buckets (
    connection: InfluxDBConnection
  ): Promise<TableResult> {
    if (connection.version === InfluxConnectionVersion.V1) {
      return this.bucketsV1(connection)
    } else {
      return this.bucketsV2(connection)
    }
  }

  public static async measurements (
    connection: InfluxDBConnection,
    bucket: string
  ): Promise<TableResult> {
    if (connection.version === InfluxConnectionVersion.V1) {
      return this.measurementsV1(connection, bucket)
    } else {
      return this.measurementsV2(connection, bucket)
    }
  }

  public static async tagKeys (
    connection: InfluxDBConnection,
    bucket: string,
    measurement: string
  ): Promise<TableResult> {
    if (connection.version === InfluxConnectionVersion.V1) {
      return this.tagKeysV1(connection, bucket, measurement)
    } else {
      return this.tagKeysV2(connection, bucket, measurement)
    }
  }

  public static async bucketTagKeys (connection: InfluxDBConnection, bucket: string) {
    if (connection.version === InfluxConnectionVersion.V1) {
      return this.bucketTagKeysV1(connection, bucket)
    } else {
      return this.bucketTagKeysV2(connection, bucket)
    }
  }

  public static async bucketTagKeysV1 (connection: InfluxDBConnection, bucket: string) {
    const query = 'show tag keys'
    const results = await APIRequest.queryV1(connection, query)
    return results ? results[0] : EmptyTableResult
  }

  public static async bucketTagKeysV2 (connection: InfluxDBConnection, bucket: string) {
    const query = `
      import "influxdata/influxdb/v1"
      v1.tagKeys(bucket:"${bucket}")`

    const results = await APIRequest.queryV2(connection, query)
    return results ? results[0] : EmptyTableResult
  }

  private static async tagKeysV1 (
    connection: InfluxDBConnection,
    bucket: string,
    measurement: string
  ): Promise<TableResult> {
    const query = `show tag keys from ${measurement}`
    const results = await APIRequest.queryV1(connection, query, bucket)
    return results ? results[0] : EmptyTableResult
  }

  private static async tagKeysV2 (
    connection: InfluxDBConnection,
    bucket: string,
    measurement: string
  ): Promise<TableResult> {
    const query = `
      import "influxdata/influxdb/v1"
      v1.measurementTagKeys(bucket:"${bucket}", measurement: "${measurement}")`

    const results = await APIRequest.queryV2(connection, query)
    return results ? results[0] : EmptyTableResult
  }

  private static async measurementsV1 (
    connection: InfluxDBConnection,
    bucket: string
  ): Promise<TableResult> {
    const query = 'show measurements'
    const results = await APIRequest.queryV1(connection, query, bucket)
    return results ? results[0] : EmptyTableResult
  }

  private static async measurementsV2 (
    connection: InfluxDBConnection,
    bucket: string
  ): Promise<TableResult> {
    const query = `import "influxdata/influxdb/v1"
      v1.measurements(bucket:"${bucket}")`
    const results = await APIRequest.queryV2(connection, query)
    return results ? results[0] : EmptyTableResult
  }

  private static async bucketsV1 (
    connection: InfluxDBConnection
  ): Promise<TableResult> {
    const query = 'show databases'
    const results = await APIRequest.queryV1(connection, query)
    return results ? results[0] : EmptyTableResult
  }

  private static async bucketsV2 (
    connection: InfluxDBConnection
  ): Promise<TableResult> {
    const query = 'buckets()'
    const results = await APIRequest.queryV2(connection, query)
    return results ? results[0] : EmptyTableResult
  }
}

interface V1Result {
  series: Array<V1Row>;
  error: string;
}

interface V1Row {
  columns: Array<string>;
  values: Array<Array<string>>;
}

export class APIRequest {
  public static async queryV1 (
    conn: InfluxDBConnection,
    query: string,
    bucket: string = ''
  ): Promise<TableResult[]> {
    let data = {
      results: []
    }
    try {
      const source = axios.CancelToken.source()
      Status.SetRunningQuery(source)
      const encodedQuery = encodeURI(query)
      const url = `${conn.hostNport}/query?db=${encodeURI(
        bucket
      )}&q=${encodedQuery}`
      data = (await axios({ method: 'GET', url, cancelToken: source.token })).data
    } catch (err) {
      const message = err?.response?.data?.error
      if (message) {
        throw new Error(message)
      } else if (err instanceof Error) {
        // connection error
        throw err
      } else {
        // unknown error
        throw new Error(err.toString())
      }
    } finally {
      Status.SetNotRunnningQuery()
    }
    return v1QueryResponseToTableResult(data)
  }

  public static defaultParams = {
    method: 'POST'
  };

  public static cancelQuery () {
    const source = Status.CancelTokenSource
    if (source) {
      source.cancel()
    }
  }

  public static async queryV2 (
    conn: InfluxDBConnection,
    query: string
  ): Promise<TableResult[]> {
    let data:string = ''
    try {
      const source = axios.CancelToken.source()
      Status.SetRunningQuery(source)
      data = (await axios({
        method: 'POST',
        url: `${conn.hostNport}/api/v2/query?org=${encodeURI(conn.org)}`,
        data: {
          type: 'flux',
          query: query,
          dialect: {
            annotations: ['group', 'datatype', 'default']
          }
        },
        maxContentLength: Infinity,
        headers: {
          Authorization: `Token ${conn.token}`
        },
        cancelToken: source.token
      })).data
    } catch (err) {
      const message = err?.response?.data?.message || err?.response?.data?.error
      if (message) {
        throw new Error(message)
      } else if (err instanceof Error) {
        // connection error
        throw err
      } else {
        // unknown error
        throw new Error(err.toString())
      }
    } finally {
      Status.SetNotRunnningQuery()
    }
    return queryResponseToTableResult(data)
  }
}

export function queryResponseToTableResult (body: string): TableResult[] {
  const accum: TableResult[] = []
  return body.split(/\r?\n\r?\n/)
    .filter(v => v) // kill the blank lines
    .reduce((acc, group) => {
      const rows = group.split('\n').filter(v => !v.startsWith('#') && v)
      const result: TableResult = {
        head: rows[0].split(',').slice(3),
        rows: rows.slice(1).map(v => v.split(',').slice(3))
      }
      acc.push(result)
      return acc
    }, accum)
}

function v1QueryResponseToTableResult (body: {
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

  results[0].series.forEach(result => {
    tableResults.push({
      head: result.columns,
      rows: result.values
    })
  })

  return tableResults
}
