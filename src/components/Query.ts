import { OutputChannel, ExtensionContext, window } from "vscode";
import { InfluxDBConnection } from "./connections/Connection";
import { TableResult, TableView } from "./TableView";
import { Status } from "./connections/Status";
import { INode } from "./connections/INode";
import axios from "axios";

function now(): string {
  var d = new Date();
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
  let yy = d.getFullYear();
  let mm = pad(d.getMonth() + 1);
  let dd = pad(d.getDate());
  let h = pad(d.getHours());
  let m = pad(d.getMinutes());
  let s = pad(d.getSeconds());
  let z = timezoneOffset(d.getTimezoneOffset());
  return `${yy}-${mm}-${dd}T${h}:${m}:${s}${z}`;
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
      iConn: InfluxDBConnection
    ) => INode
  ): Promise<INode[]> {
    this.outputChannel.show();
    this.outputChannel.appendLine(`${now()} - ${msg}`);
    let result: Result = await APIRequest.Query(conn, query);
    if (result.Err !== undefined) {
      this.outputChannel.appendLine(`${now()} - Err: ${result.Err}`);
    } else {
      var nodes: Array<INode> = [];
      for (let row of (result.Result as TableResult).Rows) {
        nodes.push(newNodeFn(row[0], this.outputChannel, conn));
      }
      return nodes;
    }
    return [];
  }
}

export class ViewEngine extends Engine {
  private tableView: TableView;

  public constructor(context: ExtensionContext, outputChannel: OutputChannel) {
    super(outputChannel);
    this.tableView = new TableView(context);
  }

  public async TableView(iConn?: InfluxDBConnection, query?: string) {
    if (!query && !window.activeTextEditor) {
      window.showWarningMessage("No Flux file selected");
      return;
    } else if (!query && window.activeTextEditor) {
      if (window.activeTextEditor.selection.isEmpty) {
        query = window.activeTextEditor.document.getText();
      } else {
        query = window.activeTextEditor.document.getText(
          window.activeTextEditor.selection
        );
      }
    }

    if (!iConn && Status.Current !== undefined) {
      iConn = Status.Current;
    } else if (!iConn) {
      window.showWarningMessage("No influxDB Server selected");
      return;
    }

    this.outputChannel.appendLine(`${now()} - Running Query: '${query}'`);
    this.outputChannel.show();

    if (query === undefined) {
      query = "";
    }
    let result = await APIRequest.Query(iConn, query);
    if (result.Err === undefined) {
      this.tableView.show(result.Result as TableResult, iConn.name);
    } else {
      this.outputChannel.appendLine(`${now()} - ${result.Err}`);
    }
  }
}

interface Result {
  Result: TableResult | undefined;
  Err: string | undefined;
}

export class APIRequest {
  public static async Query(
    conn: InfluxDBConnection,
    query: string
  ): Promise<Result> {
    try {
      const resp = await axios({
        method: "POST",
        url: `${conn.hostNport}/api/v2/query?org=${encodeURI(conn.org)}`,
        data: query,
        headers: {
          "Content-Type": "application/vnd.flux",
          Authorization: "Token " + conn.token
        }
      });
      let tableResult: TableResult = {
        Head: [],
        Rows: []
      };
      let results: Array<string> = resp.data.split("\r\n");
      var isHead: boolean = true;
      for (let row of results) {
        if (row === "") {
          continue;
        }
        let fields = row.split(",").slice(3);
        if (isHead) {
          tableResult.Head.push(...fields);
          isHead = false;
          continue;
        }
        tableResult.Rows.push(fields);
      }
      return {
        Result: tableResult,
        Err: undefined
      };
    } catch (err) {
      let message = String(err);
      if (err.response) {
        message = err.response.data.message;
      }
      return {
        Result: undefined,
        Err: message
      };
    }
  }
}
