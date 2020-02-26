import { OutputChannel, ExtensionContext, window } from 'vscode'
import {
  InfluxDBConnection,
  InfluxConnectionVersion
} from './connections/Connection'
import { TableResult, TableView } from './TableView'
import { Status } from './connections/Status'
import { INode } from './connections/INode'
import axios from 'axios'

import { now, outputChannel } from '../util'

export class Engine {
  public constructor () {}

  public async GetTreeChildren (
    conn: InfluxDBConnection,
    query: string,
    msg: string,
    newNodeFn: (
      name: string,
      outputChannel: OutputChannel,
      iConn: InfluxDBConnection,
      parent?: string
    ) => INode,
    pp = ''
  ): Promise<INode[]> {
    outputChannel.show()
    outputChannel.appendLine(`${now()} - ${msg}`)

    let result: TableResult
    try {
      if (conn.version === InfluxConnectionVersion.V1) {
        result = await APIRequest.queryV1(conn, query, pp)
      } else {
        result = await APIRequest.queryV2(conn, query)
      }
    } catch (e) {
      outputChannel.appendLine(`${now()} - Error: ${e}`)
      return []
    }

    return (result?.rows || []).map(row => {
      return newNodeFn(row[0], outputChannel, conn, pp)
    })
  }
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

    outputChannel.appendLine(`${now()} - Running Query: '${query}'`)
    outputChannel.show()

    try {
      const result = await APIRequest.queryV2(connection, query)
      return this.tableView.show(result, connection.name)
    } catch (e) {
      outputChannel.appendLine(`${now()} - ${e}`)
    }
  }
}

export class Queries {
  public static async buckets (
    connection: InfluxDBConnection
  ): Promise<TableResult> {
    if (connection.version === InfluxConnectionVersion.V1) {
      return await this.bucketsV1(connection)
    } else {
      return await this.bucketsV2(connection)
    }
  }

  public static async measurements (
    connection: InfluxDBConnection,
    bucket: string
  ): Promise<TableResult> {
    if (connection.version === InfluxConnectionVersion.V1) {
      return await this.measurementsV1(connection, bucket)
    } else {
      return await this.measurementsV2(connection, bucket)
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

  private static async tagKeysV1 (
    connection: InfluxDBConnection,
    bucket: string,
    measurement: string
  ): Promise<TableResult> {
    const query = `show tag keys from ${measurement}`
    return await APIRequest.queryV1(connection, query, bucket)
  }

  private static async tagKeysV2 (
    connection: InfluxDBConnection,
    bucket: string,
    measurement: string
  ): Promise<TableResult> {
    const query = `
      import "influxdata/influxdb/v1"
      v1.measurementTagKeys(bucket:"${bucket}", measurement: "${measurement}")`

    return await APIRequest.queryV2(connection, query)
  }

  private static async measurementsV1 (
    connection: InfluxDBConnection,
    bucket: string
  ): Promise<TableResult> {
    const query = 'show measurements'
    return await APIRequest.queryV1(connection, query, bucket)
  }

  private static async measurementsV2 (
    connection: InfluxDBConnection,
    bucket: string
  ): Promise<TableResult> {
    const query = `import "influxdata/influxdb/v1"
      v1.measurements(bucket:"${bucket}")`
    return await APIRequest.queryV2(connection, query)
  }

  private static async bucketsV1 (
    connection: InfluxDBConnection
  ): Promise<TableResult> {
    const query = 'show databases'
    return await APIRequest.queryV1(connection, query)
  }

  private static async bucketsV2 (
    connection: InfluxDBConnection
  ): Promise<TableResult> {
    const query = 'buckets()'
    return await APIRequest.queryV2(connection, query)
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
  ): Promise<TableResult> {
    try {
      const encodedQuery = encodeURI(query)
      const url = `${conn.hostNport}/query?db=${encodeURI(
        bucket
      )}&q=${encodedQuery}`
      const resp = await axios({ method: 'GET', url })

      return v1QueryResponseToTableResult(resp.data)
    } catch (err) {
      const message = err.response?.data?.message || err.toString()
      throw new Error(message)
    }
  }

  public static defaultParams = {
    method: 'POST'
  };

  public static async queryV2 (
    conn: InfluxDBConnection,
    query: string
  ): Promise<TableResult> {
    try {
      const { data } = await axios({
        method: 'POST',
        url: `${conn.hostNport}/api/v2/query?org=${encodeURI(conn.org)}`,
        data: query,
        maxContentLength: Infinity,
        headers: {
          'Content-Type': 'application/vnd.flux',
          Authorization: `Token ${conn.token}`
        }
      })

      return queryResponseToTableResult(data)
    } catch (err) {
      const message = err?.response?.data?.message || err.toString()

      throw new Error(message)
    }
  }
}

export function queryResponseToTableResult (body: string): TableResult {
  const initial: TableResult = { head: [], rows: [] }
  const accum: TableResult[] = []
  return body
    .replace('\r', '')
    .split('\n\n')
    .reduce((acc, group) => {
      const rows = group.split('\n').filter(v => !v.startsWith('#') && v)
      const result: TableResult = {
        head: rows[0].split(',').slice(3),
        rows: rows.slice(1).map(v => v.split(',').slice(3))
      }

      acc.push(result)

      return acc
    }, accum)
    .reduce((table, result, index) => {
      if (index === 0) {
        table.head = result.head
      }

      table.rows.push(...result.rows)

      return table
    }, initial)
}

function v1QueryResponseToTableResult (body: {
  results: V1Result[];
}): TableResult {
  const tableResult: TableResult = {
    head: [],
    rows: []
  }

  const results: Array<V1Result> = body.results

  if (results.length === 0) {
    return tableResult
  }

  if (results[0]?.error) {
    throw new Error(results[0].error)
  }

  tableResult.head = results[0].series[0].columns
  tableResult.rows = results[0].series[0].values

  return tableResult
}
