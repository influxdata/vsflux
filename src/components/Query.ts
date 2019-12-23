import { OutputChannel, ExtensionContext, window } from "vscode";
import rp = require("request-promise");
import { InfluxDBConnection } from "./connections/Connection";
import { TableResult, TableView } from "./TableView";
import { Status } from "./connections/Status";
import { INode } from "./connections/INode";

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
    this.outputChannel.appendLine(msg);
    let result: Result = await APIRequest.Query(conn, query);
    if (result.Err !== undefined) {
      this.outputChannel.appendLine("Err: " + result.Err);
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

    this.outputChannel.appendLine("Running Query: '" + query + "'\n\r");
    this.outputChannel.show();

    if (query === undefined) {
      query = "";
    }
    let result = await APIRequest.Query(iConn, query);
    if (result.Err === undefined) {
      this.tableView.show(result.Result as TableResult, iConn.name);
    } else {
      this.outputChannel.appendLine(result.Err);
    }
  }
}

interface Result {
  Result: TableResult | undefined;
  Err: string | undefined;
}

class APIRequest {
  public static async Query(
    conn: InfluxDBConnection,
    query: string
  ): Promise<Result> {
    try {
      const { body } = await rp.post({
        method: "POST",
        url: conn.hostNport + "/api/v2/query?org=" + conn.org,
        body: query,
        headers: {
          "Content-Type": "application/vnd.flux",
          Authorization: "Token " + conn.token
        },
        resolveWithFullResponse: true
      });
      let tableResult: TableResult = {
        Head: [],
        Rows: []
      };
      let results: Array<string> = body.split("\r\n");
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
      return {
        Result: undefined,
        Err: String(err)
      };
    }
  }
}
