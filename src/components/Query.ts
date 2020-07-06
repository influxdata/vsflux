import { ExtensionContext, window } from 'vscode'
import {
  InfluxDBConnection,
  InfluxConnectionVersion
} from './connections/Connection'
import { TableView } from './TableView'
import { Status } from './connections/Status'
import axios, { CancelTokenSource } from 'axios'

import { TableResult, QueryResult, EmptyTableResult, v1QueryResponseToTableResult, queryResponseToTableResult } from './util/query'

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

  private showNoConnectionWarning () {
    window.showWarningMessage('No influxDB Server selected')
  }

  private showNoFluxWarning () {
    return window.showWarningMessage('No Flux file selected')
  }

  private get query () {
    const { activeTextEditor } = window

    if (!activeTextEditor) {
      return
    }

    if (activeTextEditor.selection.isEmpty) {
      return activeTextEditor.document.getText()
    }

    return activeTextEditor.document.getText(activeTextEditor.selection)
  }

  public async showTable () {
    if (!this.query) {
      return this.showNoFluxWarning()
    }

    if (!Status.Current) {
      window.showWarningMessage('No influxDB Server selected')
      return
    }

    logger.log(`Running Query: '${this.query}'`)

    try {
      const results = await APIRequest.query(Status.Current, this.query)
      return this.tableView.show(results.tables, Status.Current?.name)
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

  public static async tagValues (
    connection: InfluxDBConnection,
    bucket: string,
    tag: string
  ): Promise<TableResult> {
    if (connection.version === InfluxConnectionVersion.V2) {
      const query = `
      import "influxdata/influxdb/v1"
      v1.tagValues(bucket:"${bucket}", tag: "${tag}")`

      const results = await APIRequest.queryV2(connection, query)
      return results ? results.tables[0] : EmptyTableResult
    }

    return EmptyTableResult
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

  public static async bucketTagKeys (
    connection: InfluxDBConnection,
    bucket: string
  ) {
    if (connection.version === InfluxConnectionVersion.V1) {
      return this.bucketTagKeysV1(connection, bucket)
    } else {
      return this.bucketTagKeysV2(connection, bucket)
    }
  }

  public static async bucketTagKeysV1 (
    connection: InfluxDBConnection,
    bucket: string
  ) {
    const query = 'show tag keys'
    const results = await APIRequest.queryV1(connection, query)
    return results ? results.tables[0] : EmptyTableResult
  }

  public static async bucketTagKeysV2 (
    connection: InfluxDBConnection,
    bucket: string
  ) {
    const query = `
      import "influxdata/influxdb/v1"
      v1.tagKeys(bucket:"${bucket}")`

    const results = await APIRequest.queryV2(connection, query)
    return results ? results.tables[0] : EmptyTableResult
  }

  private static async tagKeysV1 (
    connection: InfluxDBConnection,
    bucket: string,
    measurement: string
  ): Promise<TableResult> {
    const query = `show tag keys from ${measurement}`
    const results = await APIRequest.queryV1(connection, query, bucket)
    return results ? results.tables[0] : EmptyTableResult
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
    return results ? results.tables[0] : EmptyTableResult
  }

  private static async measurementsV1 (
    connection: InfluxDBConnection,
    bucket: string
  ): Promise<TableResult> {
    const query = 'show measurements'
    const results = await APIRequest.queryV1(connection, query, bucket)
    return results ? results.tables[0] : EmptyTableResult
  }

  private static async measurementsV2 (
    connection: InfluxDBConnection,
    bucket: string
  ): Promise<TableResult> {
    const query = `import "influxdata/influxdb/v1"
      v1.measurements(bucket:"${bucket}")`
    const results = await APIRequest.queryV2(connection, query)
    return results ? results.tables[0] : EmptyTableResult
  }

  private static async bucketsV1 (
    connection: InfluxDBConnection
  ): Promise<TableResult> {
    const query = 'show databases'
    const results = await APIRequest.queryV1(connection, query)
    return results ? results.tables[0] : EmptyTableResult
  }

  private static async bucketsV2 (
    connection: InfluxDBConnection
  ): Promise<TableResult> {
    const query = 'buckets()'
    const results = await APIRequest.queryV2(connection, query)
    return results ? results.tables[0] : EmptyTableResult
  }
}

export class APIRequest {
  private static source?: CancelTokenSource;

  public static async queryV1 (
    conn: InfluxDBConnection,
    query: string,
    bucket: string = ''
  ): Promise<QueryResult> {
    let data = {
      results: []
    }
    try {
      this.source = axios.CancelToken.source()
      const encodedQuery = encodeURI(query)
      const url = `${conn.hostNport}/query?db=${encodeURI(
        bucket
      )}&q=${encodedQuery}`
      data = (await axios({ method: 'GET', url, cancelToken: this.source.token }))
        .data
    } catch (err) {
      const message = err?.response?.data?.error
      if (message) {
        throw new Error(message)
      } else if (err instanceof Error) {
        throw err
      } else {
        throw new Error(err.toString())
      }
    } finally {
      Status.SetNotRunnningQuery()
    }
    const tables = v1QueryResponseToTableResult(data)

    return {
      tables,
      raw: JSON.stringify(data.results)
    }
  }

  public static defaultParams = {
    method: 'POST'
  };

  public static cancelQuery () {
    if (this.source) {
      this.source.cancel()
      this.source = undefined
    }
  }

  public static async query (conn: InfluxDBConnection, query: string, bucket: string = ''): Promise<QueryResult> {
    if (conn.version === InfluxConnectionVersion.V1) {
      return this.queryV1(conn, query, bucket)
    } else {
      return this.queryV2(conn, query)
    }
  }

  public static async queryV2 (
    conn: InfluxDBConnection,
    query: string
  ): Promise<QueryResult> {
    let data: string = ''
    try {
      this.source = axios.CancelToken.source()
      data = (
        await axios({
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
          cancelToken: this.source.token
        })
      ).data
    } catch (err) {
      const message =
        err?.response?.data?.message || err?.response?.data?.error
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
    const tables = queryResponseToTableResult(data)

    return {
      tables,
      raw: data
    }
  }
}
