import * as vscode from "vscode";
import { ViewEngine as QueryViewEngine, APIRequest, Queries } from "../Query";
import { INode } from "./INode";
import { Status } from "./Status";
import { ConnectionNode, InfluxDBConectionsKey } from "./ConnectionNode";
import { EditConnectionView } from "./EditConnectionView";
import { ExtensionContext } from "vscode";

const uuidv1 = require("uuid/v1");
export interface InfluxDBConnection {
  readonly version: InfluxConnectionVersion;
  readonly id: string;
  readonly name: string;
  readonly hostNport: string;
  readonly token: string;
  readonly org: string;
  isActive: boolean;
}

export function emptyInfluxDBConnection(): InfluxDBConnection {
  return {
    version: InfluxConnectionVersion.V2,
    id: "",
    name: "",
    hostNport: "",
    token: "",
    org: "",
    isActive: false
  };
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
    if (element) {
      return element.getChildren(this.outputChannel);
    }
    return this.getConnectionNodes(this.outputChannel);
  }

  public refresh(element?: INode): void {
    this._onDidChangeTreeData.fire(element);
  }

  public async addConnection(context: ExtensionContext) {
    let defaultURL = "",
      defaultURLV1 = "";
    let workspaceConfig = vscode.workspace.getConfiguration("vsflux");
    if (workspaceConfig?.get<string>("defaultInfluxDBURL")) {
      defaultURL = workspaceConfig.get<string>("defaultInfluxDBURL", "");
    }
    if (workspaceConfig?.get<string>("defaultInfluxDBV1URL")) {
      defaultURLV1 = workspaceConfig?.get<string>("defaultInfluxDBV1URL", "");
    }
    let addConnView = new EditConnectionView(context);
    await addConnView.showNew(defaultURL, defaultURLV1, this);
    return;
  }

  public static handleMessage(
    panel: vscode.WebviewPanel,
    tree: InfluxDBTreeDataProvider
  ) {
    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(async (message: Message) => {
      switch (message.command) {
        case MessageType.Save:
          this.saveConn(panel, tree, message);
        case MessageType.Test:
          this.testConn(message);
      }
    }, null);
  }

  private async getConnectionNodes(
    outputChannel: vscode.OutputChannel
  ): Promise<ConnectionNode[]> {
    const connections = this.context.globalState.get<{
      [key: string]: InfluxDBConnection;
    }>(InfluxDBConectionsKey);
    const ConnectionNodes = [];
    if (connections) {
      const activeID = Status.Current?.id;
      for (const id of Object.keys(connections)) {
        connections[id].isActive = activeID === id || connections[id].isActive;
        if (connections[id].isActive) {
          Status.Current = connections[id];
        }

        ConnectionNodes.push(
          new ConnectionNode(connections[id], outputChannel)
        );
      }

      // if there is only one connection, set it to active.
      if (ConnectionNodes.length === 1) {
        ConnectionNodes[0].iConn.isActive = true;
        Status.Current = ConnectionNodes[0].iConn;
      }
    }
    return ConnectionNodes;
  }

  private static async testConn(message: Message) {
    let conn: InfluxDBConnection = convertMessageToConnection(message, uuidv1());

    try {
      let buckets = Queries.buckets(conn);

      vscode.window.showInformationMessage("Success");
      return;
    } catch (e) {
      vscode.window.showErrorMessage(e);
      return;
    }

  }

  public static async SwitchConn(
    tree: InfluxDBTreeDataProvider,
    target: InfluxDBConnection
  ) {
    let connections = tree.context.globalState.get<{
      [key: string]: InfluxDBConnection;
    }>(InfluxDBConectionsKey) || {};

    target.isActive = true
    connections[target.id] = target;

    for (const connID of Object.keys(connections)) {
      if (target.id !== connID) {
        connections[connID].isActive = false;
      }
    }

    Status.Current = connections[target.id];
    await tree.context.globalState.update(InfluxDBConectionsKey, connections);
    tree.refresh();
  }

  private static async saveConn(
    panel: vscode.WebviewPanel,
    tree: InfluxDBTreeDataProvider,
    message: Message
  ) {
    let id = message.connID || uuidv1();
    let target = convertMessageToConnection(message, id, true);
    await this.SwitchConn(tree, target);

    panel.dispose();
    return;
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
        treeData.addConnection(this.context);
      })
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "influxdb.deleteConnection",
        async (connectionNode: ConnectionNode) => {
          let option = { title: "Confrim" };
          const selection = await vscode.window.showInformationMessage(
            "You are about to delete the connection.",
            option
          );
          if (selection !== option) {
            return;
          }
          connectionNode.deleteConnection(this.context, treeData);
        }
      )
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "influxdb.editConnection",
        (connectionNode: ConnectionNode) => {
          connectionNode.editConnection(this.context, treeData);
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
        async (connNode: ConnectionNode) => {
          Status.Current = connNode.iConn;
          connNode.iConn.isActive = true;
          await InfluxDBTreeDataProvider.SwitchConn(treeData, connNode.iConn);
        }
      )
    );
  }
}

interface Message {
  readonly command: MessageType;
  readonly connID: string;
  readonly connVersion: number;
  readonly connName: string;
  readonly connHost: string;
  readonly connToken: string;
  readonly connOrg: string;
}

function convertMessageToConnection(
  message: Message,
  id: string,
  isActive: boolean = false
): InfluxDBConnection {
  return {
    version:
      message.connVersion > 0
        ? InfluxConnectionVersion.V1
        : InfluxConnectionVersion.V2,
    id: id,
    name: message.connName,
    hostNport: message.connHost,
    token: message.connToken,
    org: message.connOrg,
    isActive: isActive
  };
}

enum MessageType {
  Test = "testConn",
  Save = "save"
}

export enum InfluxConnectionVersion {
  V2 = 0,
  V1 = 1
}
