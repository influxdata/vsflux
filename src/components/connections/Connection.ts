import * as vscode from 'vscode'
import { v1 as uuid } from 'uuid'

import { ViewEngine as QueryViewEngine, Queries, APIRequest } from '../Query'
import { INode } from './INode'
import { Status } from './Status'
import { ConnectionNode, InfluxDBConectionsKey } from './ConnectionNode'
import { ConnectionView } from './ConnectionView'

enum MessageType {
  Test = 'testConn',
  Save = 'save'
}

export enum InfluxConnectionVersion {
  V2 = 0,
  V1 = 1
}
export interface InfluxDBConnection {
  readonly version: InfluxConnectionVersion;
  readonly id: string;
  readonly name: string;
  readonly hostNport: string;
  readonly token: string;
  readonly org: string;
  isActive: boolean;
}

export const emptyInfluxDBConnection: InfluxDBConnection = {
  version: InfluxConnectionVersion.V2,
  id: '',
  name: '',
  hostNport: '',
  token: '',
  org: '',
  isActive: false
}

export class InfluxDBTreeDataProvider
implements vscode.TreeDataProvider<INode> {
  public static instance: InfluxDBTreeDataProvider;

  public static init (context: vscode.ExtensionContext) {
    this.instance = new InfluxDBTreeDataProvider(context)
  }

  public _onDidChangeTreeData: vscode.EventEmitter<
    INode
  > = new vscode.EventEmitter<INode>();

  public readonly onDidChangeTreeData: vscode.Event<INode> = this
    ._onDidChangeTreeData.event;

  constructor (
    private context: vscode.ExtensionContext
  ) {}

  getTreeItem (element: INode): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element.getTreeItem()
  }

  getChildren (element?: INode): Thenable<INode[]> | INode[] {
    if (element) {
      return element.getChildren()
    }
    return this.getConnectionNodes()
  }

  public refresh (element?: INode): void {
    this._onDidChangeTreeData.fire(element)
  }

  public async addConnection () {
    const addConnView = new ConnectionView(this.context)
    await addConnView.create()
  }

  public setMessageHandler (
    panel: vscode.WebviewPanel
  ) {
    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(async (message: Message) => {
      const conn = convertMessageToConnection(message, uuid())
      switch (message.command) {
        case MessageType.Save:
          this.saveConnection(panel, message)
          break
        case MessageType.Test:
          this.testConnection(conn)
          break
      }
    }, null)
  }

  private async getConnectionNodes (
  ): Promise<ConnectionNode[]> {
    const connections = this.context.globalState.get<{
      [key: string]: InfluxDBConnection;
    }>(InfluxDBConectionsKey) || {}
    const ConnectionNodes = []
    const activeID = Status.Current?.id

    for (const [id, connection] of Object.entries(connections)) {
      connection.isActive = activeID === id || connection.isActive

      if (connection.isActive) {
        Status.Current = connection
      }

      ConnectionNodes.push(
        new ConnectionNode(connection, this.context)
      )
    }

    // if there is only one connection, set it to active.
    if (ConnectionNodes.length === 1) {
      ConnectionNodes[0].connection.isActive = true
      Status.Current = ConnectionNodes[0].connection
    }
    return ConnectionNodes
  }

  private async testConnection (conn: InfluxDBConnection) {
    try {
      await Queries.buckets(conn)
      vscode.window.showInformationMessage('Success')
    } catch (e) {
      console.error(e)
      vscode.window.showErrorMessage('Failed to connect to database')
    }
  }

  public async setCurrent (
    target: InfluxDBConnection
  ) {
    const connections = this.context.globalState.get<{
      [key: string]: InfluxDBConnection;
    }>(InfluxDBConectionsKey) || {}

    for (const connection of Object.values(connections)) {
      connection.isActive = false
    }

    target.isActive = true
    connections[target.id] = target
    Status.Current = target

    await this.context.globalState.update(InfluxDBConectionsKey, connections)
    this.refresh()
  }

  private async saveConnection (
    panel: vscode.WebviewPanel,
    message: Message
  ) {
    const id = message.connID || uuid()
    const target = convertMessageToConnection(message, id, true)
    await this.setCurrent(target)

    panel.dispose()
  }
}

export class Connection {
  private queryViewEngine: QueryViewEngine;
  private context: vscode.ExtensionContext;

  public constructor (context: vscode.ExtensionContext) {
    this.context = context
    this.queryViewEngine = new QueryViewEngine(context)
  }

  public static load (context: vscode.ExtensionContext) {
    const connection = new Connection(context)
    connection.load()

    return connection
  }

  public load () {
    this.context.subscriptions.push(
      vscode.window.registerTreeDataProvider('influxdb', this.tree)
    )

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        'influxdb.refresh',
        this.refresh
      )
    )

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        'influxdb.addConnection',
        this.addConnection
      )
    )

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        'influxdb.removeConnection',
        this.removeConnection
      )
    )

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        'influxdb.editConnection',
        this.editConnection
      )
    )

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        'influxdb.runQuery',
        this.runQuery
      )
    )

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        'influxdb.switchConn',
        this.switchConnection
      )
    )

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        'influxdb.cancelQuery',
        APIRequest.cancelQuery
      )
    )
  }

  private refresh = () => {
    this.tree.refresh()
  }

  private addConnection = () => {
    this.tree.addConnection()
  }

  private editConnection = async (node: ConnectionNode) => {
    await node.edit()
  }

  private removeConnection = async (node: ConnectionNode) => {
    const removeText = 'Yes, remove it'

    const confirmation = await vscode.window.showInformationMessage(
      `Remove connection "${node.connection.name}"?`, {
        modal: true
      },
      removeText
    )

    if (confirmation !== removeText) {
      return
    }

    node.remove()
  }

  private runQuery = () => {
    this.queryViewEngine.showTable()
  }

  private switchConnection = async (node: ConnectionNode) => {
    await this.tree.setCurrent(node.connection)
  }

  private get tree (): InfluxDBTreeDataProvider {
    return InfluxDBTreeDataProvider.instance
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

function convertMessageToConnection (
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
  }
}
