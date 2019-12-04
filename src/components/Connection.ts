import * as vscode from "vscode";
import * as path from "path";
import { InfluxCli } from "./Query";

const InfluxDBConectionsKey = "influxdb.connections";

export interface InfluxDBConnection {
  readonly name: string;
  readonly hostNport: string;
  readonly token: string;
  readonly org: string;
}

interface INode {
  getTreeItem(
    context: vscode.ExtensionContext
  ): Promise<vscode.TreeItem> | vscode.TreeItem;

  getChildren(): Promise<INode[]> | INode[];
}

class ConnectionNode implements INode {
  constructor(
    private readonly id: string,
    private readonly name: string,
    private readonly hostNport: string,
    private readonly token: string,
    private readonly org: string
  ) {}

  public toConnection(): InfluxDBConnection {
    return {
      name: this.name,
      hostNport: this.hostNport,
      token: this.token,
      org: this.org
    };
  }

  public getTreeItem(context: vscode.ExtensionContext): vscode.TreeItem {
    return {
      label: this.name,
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      command: {
        title: "switchConn",
        command: "influxdb.switchConn",
        arguments: [this.toConnection()]
      },
      contextValue: "connection",
      iconPath: context.asAbsolutePath("resources/server.png")
    };
  }

  public async getChildren(): Promise<INode[]> {
    return [];
  }

  public async deleteConnection(
    context: vscode.ExtensionContext,
    influxDBTreeDataProvider: InfluxDBTreeDataProvider
  ) {
    const connections = context.globalState.get<{
      [key: string]: InfluxDBConnection;
    }>(InfluxDBConectionsKey);

    if (connections) {
      delete connections[this.id];
    }

    await context.globalState.update(InfluxDBConectionsKey, connections);

    influxDBTreeDataProvider.refresh();
  }
}

class UUID {
  static new() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
      var r = (Math.random() * 16) | 0,
        v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

class InfluxDBTreeDataProvider implements vscode.TreeDataProvider<INode> {
  public _onDidChangeTreeData: vscode.EventEmitter<
    INode
  > = new vscode.EventEmitter<INode>();

  public readonly onDidChangeTreeData: vscode.Event<INode> = this
    ._onDidChangeTreeData.event;

  constructor(private context: vscode.ExtensionContext) {}

  getTreeItem(
    element: ConnectionNode
  ): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element.getTreeItem(this.context);
  }

  getChildren(
    element?: ConnectionNode | undefined
  ): vscode.ProviderResult<INode[]> {
    if (!element) {
      return this.getConnectionNodes();
    }
    return [];
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

    const id = UUID.new();
    connections[id] = {
      name,
      hostNport,
      token,
      org
    };

    await this.context.globalState.update(InfluxDBConectionsKey, connections);
    ConnectionStatus.Current = connections[id];
    this.refresh();
  }

  private async getConnectionNodes(): Promise<ConnectionNode[]> {
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
            connections[id].org
          )
        );
      }
    }
    return ConnectionNodes;
  }
}

export class ConnectionStatus {
  private static _current: InfluxDBConnection;
  private static _influxdbStatusBarItem: vscode.StatusBarItem;

  static get Current(): InfluxDBConnection {
    return ConnectionStatus._current;
  }

  private static getStatusBarItemText(conn: InfluxDBConnection): string {
    return `$(server) ${conn.name}`;
  }

  static set Current(conn: InfluxDBConnection) {
    this._current = conn;
    if (ConnectionStatus._influxdbStatusBarItem) {
      ConnectionStatus._influxdbStatusBarItem.text = ConnectionStatus.getStatusBarItemText(
        conn
      );
    } else {
      ConnectionStatus._influxdbStatusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left
      );
      ConnectionStatus._influxdbStatusBarItem.text = ConnectionStatus.getStatusBarItemText(
        conn
      );
      ConnectionStatus._influxdbStatusBarItem.show();
    }
  }
}

export class Connection {
  private _influxdbCli: InfluxCli;
  public constructor(influxCliPath: string) {
    let outputChannel = vscode.window.createOutputChannel("InfluxDB");
    this._influxdbCli = new InfluxCli(influxCliPath, outputChannel);
  }

  public load(context: vscode.ExtensionContext) {
    const treeData = new InfluxDBTreeDataProvider(context);
    context.subscriptions.push(
      vscode.window.registerTreeDataProvider("influxdb", treeData)
    );

    context.subscriptions.push(
      vscode.commands.registerCommand("influxdb.refresh", () => {
        treeData.refresh();
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand("influxdb.addConnection", () => {
        treeData.addConnection();
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "influxdb.deleteConnection",
        (connectionNode: ConnectionNode) => {
          connectionNode.deleteConnection(context, treeData);
        }
      )
    );

    context.subscriptions.push(
      vscode.commands.registerCommand("influxdb.runQuery", () => {
        this._influxdbCli.Run();
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "influxdb.switchConn",
        (iConn: InfluxDBConnection) => {
          ConnectionStatus.Current = iConn;
        }
      )
    );
  }
}
