import { InfluxDB, FluxTableMetaData } from '@influxdata/influxdb-client'
import { v1 as uuid } from 'uuid'
import * as vscode from 'vscode'

import { ConnectionView } from '../views/AddEditConnectionView'
import { IConnection, InfluxConnectionVersion } from '../types'

export const InfluxDBConnectionsKey = 'influxdb.connections'

enum MessageType {
    Test = 'testConn',
    Save = 'save'
}
interface Message {
    readonly command : MessageType;
    readonly connID : string;
    readonly connVersion : number;
    readonly connName : string;
    readonly connHost : string;
    readonly connToken : string;
    readonly connOrg : string;
    readonly connUser : string;
    readonly connPass : string;
}

function convertMessageToConnection(
    message : Message,
    id : string,
    isActive : boolean = false
) : IConnection {
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
        user: message.connUser,
        pass: message.connPass,
        isActive: isActive
    }
}

class BucketModel {
    constructor(
        readonly name : string,
        private id : string,
        private retentionPeriod : number,
        private retentionPolicy : string,
    ) { }
}
class MeasurementModel {
    constructor(
        readonly name : string,
        readonly bucket : BucketModel,
    ) { }
}
class MeasurementTagModel {
    constructor(
        readonly name : string,
        private measurement : MeasurementModel,
    ) { }
}

interface ITreeNode {
    getTreeItem() : Thenable<vscode.TreeItem> | vscode.TreeItem;
    getChildren(element?: ITreeNode) : Thenable<ITreeNode[]> | ITreeNode[];
}
class Tag extends vscode.TreeItem {
    constructor(
        private connection : IConnection,
        private context : vscode.ExtensionContext,
        private tag : MeasurementTagModel,
    ) {
        super(connection.name, vscode.TreeItemCollapsibleState.None)
    }

    getTreeItem() : Thenable<vscode.TreeItem> | vscode.TreeItem {
        return {
            label: this.tag.name,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
        }
    }

    getChildren(_element?: ITreeNode) : Thenable<ITreeNode[]> | ITreeNode[] {
        return []
    }
}
class Measurement extends vscode.TreeItem {
    constructor(
        private connection : IConnection,
        private context : vscode.ExtensionContext,
        private measurement : MeasurementModel,
    ) {
        super(connection.name, vscode.TreeItemCollapsibleState.Collapsed)
    }

    getTreeItem() : Thenable<vscode.TreeItem> | vscode.TreeItem {
        return {
            label: this.measurement.name,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        }
    }
    getChildren(_element?: ITreeNode) : Thenable<ITreeNode[]> | ITreeNode[] {
        const queryApi = new InfluxDB({ url: this.connection.hostNport, token: this.connection.token }).getQueryApi(this.connection.org)
        const query = `import "influxdata/influxdb/schema"
schema.measurementTagKeys(bucket: "${this.measurement.bucket.name}", measurement: "${this.measurement.name}")`
        const self = this;
        return new Promise((resolve, reject) => {
            const children : Tag[] = []
            queryApi.queryRows(query, {
                next(row : string[], tableMeta : FluxTableMetaData) {
                    const object = tableMeta.toObject(row)
                    const tag = new MeasurementTagModel(object._value, self.measurement)
                    const node = new Tag(self.connection, self.context, tag)
                    children.push(node)
                },
                error(error : Error) {
                    reject(error)
                },
                complete() {
                    resolve(children)
                }
            })
        });

    }
}
class Bucket extends vscode.TreeItem {
    constructor(
        private connection : IConnection,
        private context : vscode.ExtensionContext,
        private bucket : BucketModel,
    ) {
        super(connection.name, vscode.TreeItemCollapsibleState.Collapsed)
    }

    getTreeItem() : Thenable<vscode.TreeItem> | vscode.TreeItem {
        return {
            label: this.bucket.name,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        }
    }

    getChildren(_element?: ITreeNode) : Thenable<ITreeNode[]> | ITreeNode[] {
        // TODO: handle 1.x connections
        const queryApi = new InfluxDB({ url: this.connection.hostNport, token: this.connection.token }).getQueryApi(this.connection.org)
        const query = `import "influxdata/influxdb/schema"
schema.measurements(bucket: "${this.bucket.name}")`
        const self = this;
        return new Promise((resolve, reject) => {
            const children : Measurement[] = []
            queryApi.queryRows(query, {
                next(row : string[], tableMeta : FluxTableMetaData) {
                    const object = tableMeta.toObject(row)
                    const measurement = new MeasurementModel(object._value, self.bucket)
                    const node = new Measurement(self.connection, self.context, measurement)
                    children.push(node)
                },
                error(error : Error) {
                    reject(error)
                },
                complete() {
                    resolve(children)
                }
            })
        });
    }
}
class Buckets extends vscode.TreeItem {
    constructor(
        private connection : IConnection,
        private context : vscode.ExtensionContext,
    ) {
        super(connection.name, vscode.TreeItemCollapsibleState.None)
        this.tooltip = `All buckets in ${this.connection.name}`
    }
    label = "Buckets"
    collapsibleState = vscode.TreeItemCollapsibleState.Collapsed

    getTreeItem() : Thenable<vscode.TreeItem> | vscode.TreeItem {
        return this
    }

    getChildren(_element?: ITreeNode) : Thenable<ITreeNode[]> | ITreeNode[] {
        // TODO: handle 1.x connections
        const queryApi = new InfluxDB({ url: this.connection.hostNport, token: this.connection.token }).getQueryApi(this.connection.org)
        const query = "buckets()"
        const self = this;
        return new Promise((resolve, reject) => {
            const children : Bucket[] = []
            queryApi.queryRows(query, {
                next(row : string[], tableMeta : FluxTableMetaData) {
                    const object = tableMeta.toObject(row)
                    const bucket = new BucketModel(object.name, object.id, object.retentionPeriod, object.retentionPolicy)
                    const node = new Bucket(self.connection, self.context, bucket)
                    children.push(node)
                },
                error(error : Error) {
                    reject(error)
                },
                complete() {
                    resolve(children)
                }
            })
        });
    }
}
export class Connection extends vscode.TreeItem {
    constructor(
        private connection : IConnection,
        private context : vscode.ExtensionContext,
        private parent : InfluxDBTreeProvider,
    ) {
        super(connection.name, vscode.TreeItemCollapsibleState.None)
    }

    private get status() {
        return this.connection.isActive ? '' : '-gray'
    }
    getTreeItem() : Thenable<vscode.TreeItem> | vscode.TreeItem {
        let version = "2.x"
        if (this.connection.version == InfluxConnectionVersion.V1) {
            version = "1.x"
        }
        return {
            label: this.connection.name,
            tooltip: `${this.connection.name}-${version}`,
            description: version,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            iconPath: this.context.asAbsolutePath(`resources/influx-logo${this.status}.svg`),
            contextValue: 'connection'
        }
    }

    getChildren(_element?: ITreeNode) : Thenable<ITreeNode[]> | ITreeNode[] {
        return [
            new Buckets(this.connection, this.context)
        ]
    }

    public async removeConnection(_node : Connection) {
        const removeText = 'Yes, remove it'
        const confirmation = await vscode.window.showInformationMessage(
            `Remove connection to ${this.connection.name}`, {
            modal: true
        }, removeText
        )
        if (confirmation !== removeText) {
            return
        }
        const connections = this.context.globalState.get<{
            [key : string] : IConnection;
        }>(InfluxDBConnectionsKey) || {}

        const connection = connections[this.connection.id]
        delete connections[this.connection.id]
        if (connection.isActive) {
            connections[Object.values(connections)[0].id].isActive = true
        }

        await this.context.globalState.update(InfluxDBConnectionsKey, connections)
        vscode.commands.executeCommand('influxdb.refresh')
    }
    public async editConnection() {
        const view = new ConnectionView(this.context, this.parent)
        await view.edit(this.connection)
    }
    // XXX: rockstar (27 Aug 2021) - This should live on a ConnectionModel of some sort.
    // Set the currently active connection.
    public async activate() {
        const connections = this.context.globalState.get<{
            [key : string] : IConnection;
        }>(InfluxDBConnectionsKey) || {}

        for (const connection of Object.values(connections)) {
            connection.isActive = false
        }

        this.connection.isActive = true
        connections[this.connection.id] = this.connection

        await this.context.globalState.update(InfluxDBConnectionsKey, connections)
        vscode.commands.executeCommand('influxdb.refresh')
    }

}

export class InfluxDBTreeProvider implements vscode.TreeDataProvider<ITreeNode> {
    constructor(private context : vscode.ExtensionContext) { }
    private _onDidChangeTreeData : vscode.EventEmitter<Connection | undefined | null | void> = new vscode.EventEmitter<Connection | undefined | null | void>();
    readonly onDidChangeTreeData : vscode.Event<Connection | undefined | null | void> = this._onDidChangeTreeData.event;

    refresh() : void {
        this._onDidChangeTreeData.fire()
    }

    getTreeItem(element : ITreeNode) : Thenable<vscode.TreeItem> | vscode.TreeItem {
        return element.getTreeItem()
    }

    getChildren(element?: ITreeNode) : Thenable<ITreeNode[]> | ITreeNode[] {
        if (element) {
            return element.getChildren()
        }
        const connections = this.context.globalState.get<{ [key : string] : IConnection; }>(InfluxDBConnectionsKey) || {}
        const nodes = []
        for (const [id, connection] of Object.entries(connections)) {
            let version = "2.x"
            if (connection.version == InfluxConnectionVersion.V1) {
                version = "1.x"
            }
            const node = new Connection(connection, this.context, this)
            nodes.push(node)
        }
        return nodes
    }

    // XXX: rockstar (25 Aug 2021) - This method exists here out of
    // laziness/lack of a better place to put it. It doesn't really belong here.
    // Handle messages sent from the Add/Edit Connection view
    public async setMessageHandler(
        panel : vscode.WebviewPanel
    ) {
        panel.webview.onDidReceiveMessage(async (message : Message) => {
            const connection = convertMessageToConnection(message, uuid())
            switch (message.command) {
                case MessageType.Save:
                    const id = message.connID || uuid()
                    const target = convertMessageToConnection(message, id, true)

                    const connections = this.context.globalState.get<{
                        [key : string] : IConnection;
                    }>(InfluxDBConnectionsKey) || {}
                    for (const connection of Object.values(connections)) {
                        connection.isActive = false
                    }
                    connections[target.id] = target
                    await this.context.globalState.update(InfluxDBConnectionsKey, connections)
                    vscode.commands.executeCommand('influxdb.refresh')
                    panel.dispose()
                    break
                case MessageType.Test:
                    try {
                        // TODO: handle 1.x connections
                        const queryApi = new InfluxDB({ url: connection.hostNport, token: connection.token }).getQueryApi(connection.org)
                        const query = "buckets()"
                        const self = this;
                        const children : Measurement[] = []
                        queryApi.queryRows(query, {
                            next(_row : string[], _tableMeta : FluxTableMetaData) { },
                            error(error : Error) {
                                throw error
                            },
                            complete() {
                                vscode.window.showInformationMessage('Connection successful')
                            }
                        })
                    } catch (e) {
                        vscode.window.showErrorMessage('Failed to connect to database')
                        console.error(e)
                    }
                    break
                default:
                    console.error(`Unhandled message type: ${message.command}`)
            }

        }, null)
    }
}