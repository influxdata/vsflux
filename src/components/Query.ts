import { OutputChannel, ExtensionContext, window } from "vscode";
import {
  InfluxDBConnection,
  InfluxConnectionVersion
} from "./connections/Connection";
import { TableResult, TableView } from "./TableView";
import { Status } from "./connections/Status";
import { INode } from "./connections/INode";
import axios from "axios";

function pad(n: number) {
  return n < 10 ? "0" + n : n;
}

function timezoneOffset(offset: number): string {
  var sign;
  if (offset === 0) {
    return "Z";
  }

  sign = offset > 0 ? "-" : "+";
  offset = Math.abs(offset);
  var hh = pad(Math.floor(offset / 60));
  var mm = pad(offset % 60);
  return `${sign}${hh}:${mm}`;
}

function now(): string {
  var d = new Date();
  let year = d.getFullYear();
  let month = pad(d.getMonth() + 1);
  let day = pad(d.getDate());
  let hour = pad(d.getHours());
  let minutes = pad(d.getMinutes());
  let seconds = pad(d.getSeconds());
  let timezone = timezoneOffset(d.getTimezoneOffset());
  return `${year}-${month}-${day}T${hour}:${minutes}:${seconds}${timezone}`;
}

export class Engine {
  public constructor(protected outputChannel: OutputChannel) {}

  public async GetTreeChildren(
    conn: InfluxDBConnection,
    query: string,
    msg: string,
    newNodeFn: (
      name: string,
      outputChannel: OutputChannel,
      iConn: InfluxDBConnection,
      parent?: string
    ) => INode,
    pp = ""
  ): Promise<INode[]> {
    this.outputChannel.show();
    this.outputChannel.appendLine(`${now()} - ${msg}`);

    let result: TableResult;
    try {
      if (conn.version === InfluxConnectionVersion.V1) {
        result = await APIRequest.queryV1(conn, query, pp);
      } else {
        result = await APIRequest.queryV2(conn, query);
      }
    } catch (e) {
      this.outputChannel.appendLine(`${now()} - Error: ${e}`);
      return [];
    }

    return (result?.Rows || {}).map((row) => {
      return newNodeFn(row[0], this.outputChannel, conn, pp);
    })
  }
}

export class ViewEngine extends Engine {
  private tableView: TableView;

  public constructor(context: ExtensionContext, outputChannel: OutputChannel) {
    super(outputChannel);
    this.tableView = new TableView(context);
  }

  public async TableView(connection?: InfluxDBConnection, query?: string) {
    if (!query && !window.activeTextEditor) {
      return window.showWarningMessage("No Flux file selected");
    }

    connection = connection || Status.Current;

    if (!connection) {
      window.showWarningMessage("No influxDB Server selected");
      return;
    }

    if (!query && window.activeTextEditor) {
      if (window.activeTextEditor.selection.isEmpty) {
        query = window.activeTextEditor.document.getText();
      } else {
        query = window.activeTextEditor.document.getText(
          window.activeTextEditor.selection
        );
      }
    }

    query = query || "";

    this.outputChannel.appendLine(`${now()} - Running Query: '${query}'`);
    this.outputChannel.show();

    try {
      let result = await APIRequest.queryV2(connection, query);
      return this.tableView.show(result, connection.name);
    } catch (e) {
      this.outputChannel.appendLine(`${now()} - ${e}`);
    }
  }
}

export class Queries {
  public static async buckets(connection: InfluxDBConnection): Promise<TableResult> {
    if (connection.version == InfluxConnectionVersion.V1) {
      return await this.bucketsV1(connection);
    } else {
      return await this.bucketsV2(connection);
    }
  }

  private static async bucketsV1(connection: InfluxDBConnection): Promise<TableResult> {
    const query = "show databases";
    return await APIRequest.queryV1(connection, query);
  }

  private static async bucketsV2(connection: InfluxDBConnection): Promise<TableResult> {
    const query = "buckets()";
    return await APIRequest.queryV2(connection, query);
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
  public static async queryV1(
    conn: InfluxDBConnection,
    query: string,
    bucket: string = "",
  ): Promise<TableResult> {
    try {
      const encodedQuery = encodeURI(query);
      const url = `${conn.hostNport}/query?db=${encodeURI(bucket)}&q=${encodedQuery}`;
      const resp = await axios({ method: "GET", url });

      return v1QueryResponseToTableResult(resp.data)
    } catch (err) {
      let message = err.response?.data?.message || err.toString()
      throw new Error(message);
    }
  }

  public static defaultParams = {
    method: "POST",
  };

  public static async queryV2(
    conn: InfluxDBConnection,
    query: string
  ): Promise<TableResult> {
    try {
      const {data} = await axios({
        method: "POST",
        url: `${conn.hostNport}/api/v2/query?org=${encodeURI(conn.org)}`,
        data: query,
        maxContentLength: Infinity,
        headers: {
          "Content-Type": "application/vnd.flux",
          Authorization: `Token ${conn.token}`,
        }
      });

      return queryResponseToTableResult(data);
    } catch (err) {
      const message = err?.response?.data?.message || err.toString();

      throw new Error(message);
    }
  }
}

function queryResponseToTableResult(body: string): TableResult {
  return body.split("\r\n").filter(v => v !== "").reduce((table, row, index) => {
    let fields = row.split(",").slice(3);

    if (index === 0) {
      table.Head.push(...fields);
    } else {
      table.Rows.push(fields);
    }

    return table;
  }, {
    Head: [],
    Rows: [],
  } as TableResult);
}

function v1QueryResponseToTableResult(body: { results: V1Result[] }): TableResult {
    let tableResult: TableResult = {
    Head: [],
    Rows: []
  };

  let results: Array<V1Result> = body.results;

  if (results.length === 0) {
    return tableResult
  }

  if (results[0]?.error) {
    throw new Error(results[0].error)
  }

  tableResult.Head = results[0].series[0].columns;
  tableResult.Rows = results[0].series[0].values

  return tableResult;
}