import * as vscode from "vscode";
import { ViewEngine as QueryViewEngine } from "../Query";
import { INode } from "./INode";
import { Status } from "./Status";
import { ConnectionNode, InfluxDBConectionsKey } from "./ConnectionNode";

const uuidv1 = require("uuid/v1");
export interface InfluxDBConnection {
  readonly name: string;
  readonly hostNport: string;
  readonly token: string;
  readonly org: string;
}

export class InfluxDBTreeDataProvider
  implements vscode.TreeDataProvider<INode> {
  public _onDidChangeTreeData: vscode.EventEmitter<
    INode
  > = new vscode.EventEmitter<INode>();

  public readonly onDidChangeTreeData: vscode.Event<INode> = this
    ._onDidChangeTreeData.event;

  constructor(
    private context: vscode.ExtensionContext,
    private outputChannel: vscode.OutputChannel
  ) {}

  getTreeItem(element: INode): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element.getTreeItem(this.context);
  }

  getChildren(element?: INode): Thenable<INode[]> | INode[] {
    if (!element) {
      return this.getConnectionNodes(this.outputChannel);
    }
    return element.getChildren(this.outputChannel);
  }

  public refresh(element?: INode): void {
    this._onDidChangeTreeData.fire(element);
  }

  public async addConnection() {
    const name = await vscode.window.showInputBox({
      prompt: "Give a name of the influxdb connection",
      placeHolder: "name",
      ignoreFocusOut: true
    });
    if (!name) {
      return;
    }

    const hostNport = await vscode.window.showInputBox({
      prompt: "The hostname and port of the influxdb",
      placeHolder: "http://localhost:9999",
      ignoreFocusOut: true
    });
    if (!hostNport) {
      return;
    }

    const token = await vscode.window.showInputBox({
      prompt: "token of the influxdb",
      placeHolder: "token",
      ignoreFocusOut: true
    });
    if (!token) {
      return;
    }

    const org = await vscode.window.showInputBox({
      prompt: "name of the influxdb org",
      placeHolder: "org name",
      ignoreFocusOut: true
    });
    if (!org) {
      return;
    }

    let connections = this.context.globalState.get<{
      [key: string]: InfluxDBConnection;
    }>(InfluxDBConectionsKey);

    if (!connections) {
      connections = {};
    }

    const id = uuidv1();
    connections[id] = {
      name,
      hostNport,
      token,
      org
    };

    await this.context.globalState.update(InfluxDBConectionsKey, connections);
    Status.Current = connections[id];
    this.refresh();
  }

  private async getConnectionNodes(
    outputChannel: vscode.OutputChannel
  ): Promise<ConnectionNode[]> {
    const connections = this.context.globalState.get<{
      [key: string]: InfluxDBConnection;
    }>(InfluxDBConectionsKey);
    const ConnectionNodes = [];
    if (connections) {
      for (const id of Object.keys(connections)) {
        ConnectionNodes.push(
          new ConnectionNode(
            id,
            connections[id].name,
            connections[id].hostNport,
            connections[id].token,
            connections[id].org,
            outputChannel
          )
        );
      }

      // if there is only one connection, set it to default.
      if (ConnectionNodes.length === 1) {
        Status.Current = ConnectionNodes[0].toConnection();
      }
    }
    return ConnectionNodes;
  }
}

export class Connection {
  private queryViewEngine: QueryViewEngine;
  private outputChannel: vscode.OutputChannel;
  private context: vscode.ExtensionContext;
  public constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.outputChannel = vscode.window.createOutputChannel("InfluxDB");
    this.queryViewEngine = new QueryViewEngine(context, this.outputChannel);
  }

  public load() {
    const treeData = new InfluxDBTreeDataProvider(
      this.context,
      this.outputChannel
    );
    this.context.subscriptions.push(
      vscode.window.registerTreeDataProvider("influxdb", treeData)
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand("influxdb.refresh", () => {
        treeData.refresh();
      })
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand("influxdb.addConnection", () => {
        treeData.addConnection();
      })
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "influxdb.deleteConnection",
        (connectionNode: ConnectionNode) => {
          connectionNode.deleteConnection(this.context, treeData);
        }
      )
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand("influxdb.runQuery", () => {
        this.queryViewEngine.TableView();
      })
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "influxdb.switchConn",
        (iConn: InfluxDBConnection) => {
          Status.Current = iConn;
        }
      )
    );
  }
}
