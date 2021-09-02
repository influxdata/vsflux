import { InfluxDB, FluxTableMetaData } from '@influxdata/influxdb-client'
import { TasksAPI, Task as TaskModel } from '@influxdata/influxdb-client-apis'
import { v1 as uuid } from 'uuid'
import * as vscode from 'vscode'
import * as path from 'path'
import * as os from 'os'
import * as crypto from 'crypto'
import { promises as fs } from 'fs'

import { ConnectionView } from './AddEditConnectionView'
import { AddTaskView } from './AddTaskView'
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
    isActive = false
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
        private retentionPolicy : string
    ) { }
}
class MeasurementModel {
    constructor(
        readonly name : string,
        readonly bucket : BucketModel
    ) { }
}
class MeasurementTagModel {
    constructor(
        readonly name : string,
        private measurement : MeasurementModel
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
        private tag : MeasurementTagModel
    ) {
        super(connection.name, vscode.TreeItemCollapsibleState.None)
    }

    getTreeItem() : Thenable<vscode.TreeItem> | vscode.TreeItem {
        return {
            label: this.tag.name,
            collapsibleState: vscode.TreeItemCollapsibleState.None
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
        private measurement : MeasurementModel
    ) {
        super(connection.name, vscode.TreeItemCollapsibleState.Collapsed)
    }

    getTreeItem() : Thenable<vscode.TreeItem> | vscode.TreeItem {
        return {
            label: this.measurement.name,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed
        }
    }

    getChildren(_element?: ITreeNode) : Thenable<ITreeNode[]> | ITreeNode[] {
        const queryApi = new InfluxDB({ url: this.connection.hostNport, token: this.connection.token }).getQueryApi(this.connection.org)
        const query = `import "influxdata/influxdb/schema"
schema.measurementTagKeys(bucket: "${this.measurement.bucket.name}", measurement: "${this.measurement.name}")`
        const self = this // eslint-disable-line @typescript-eslint/no-this-alias
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
        })
    }
}
class Bucket extends vscode.TreeItem {
    constructor(
        private connection : IConnection,
        private context : vscode.ExtensionContext,
        private bucket : BucketModel
    ) {
        super(connection.name, vscode.TreeItemCollapsibleState.Collapsed)
    }

    getTreeItem() : Thenable<vscode.TreeItem> | vscode.TreeItem {
        return {
            label: this.bucket.name,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed
        }
    }

    getChildren(_element?: ITreeNode) : Thenable<ITreeNode[]> | ITreeNode[] {
        // TODO: handle 1.x connections
        const queryApi = new InfluxDB({ url: this.connection.hostNport, token: this.connection.token }).getQueryApi(this.connection.org)
        const query = `import "influxdata/influxdb/schema"
schema.measurements(bucket: "${this.bucket.name}")`
        const self = this // eslint-disable-line @typescript-eslint/no-this-alias
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
        })
    }
}
class Buckets extends vscode.TreeItem {
    label = 'Buckets'
    collapsibleState = vscode.TreeItemCollapsibleState.Collapsed

    constructor(
        private connection : IConnection,
        private context : vscode.ExtensionContext
    ) {
        super(connection.name, vscode.TreeItemCollapsibleState.None)
        this.tooltip = `All buckets in ${this.connection.name}`
    }

    getTreeItem() : Thenable<vscode.TreeItem> | vscode.TreeItem {
        return this
    }

    getChildren(_element?: ITreeNode) : Thenable<ITreeNode[]> | ITreeNode[] {
        // TODO: handle 1.x connections
        const queryApi = new InfluxDB({ url: this.connection.hostNport, token: this.connection.token }).getQueryApi(this.connection.org)
        const query = 'buckets()'
        const self = this // eslint-disable-line @typescript-eslint/no-this-alias
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
        })
    }
}
export class Task extends vscode.TreeItem {
    constructor(
        private connection : IConnection,
        private context : vscode.ExtensionContext,
        private task : TaskModel
    ) {
        super(connection.name, vscode.TreeItemCollapsibleState.None)
    }

    getTreeItem() : Thenable<vscode.TreeItem> | vscode.TreeItem {
        let description = `every ${this.task.every}`
        if (this.task.every === undefined) {
            description = `${this.task.cron}`
        }
        return {
            label: this.task.name,
            description,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextValue: 'task'
        }
    }

    getChildren(_element?: ITreeNode) : Thenable<ITreeNode[]> | ITreeNode[] {
        return []
    }

    public async editTask() : Promise<void> {
        const tmpdir = os.tmpdir()
        const newFile = vscode.Uri.parse(path.join(tmpdir, `${this.task.name}.flux`))
        await fs.writeFile(newFile.path, '')
        const document = await vscode.workspace.openTextDocument(newFile.path)
        const self = this // eslint-disable-line @typescript-eslint/no-this-alias
        const listener = vscode.workspace.onWillSaveTextDocument(async (event_ : vscode.TextDocumentWillSaveEvent) => {
            if (event_.document === document) {
                const saveText = 'Save and close'
                const confirmation = await vscode.window.showInformationMessage(
                    `Save remote task ${self.task.name} to ${self.connection.name}?`, {
                    modal: true
                }, saveText)
                if (confirmation !== saveText) {
                    return
                }
                const contents = event_.document.getText()
                const influxDB = new InfluxDB({ url: self.connection.hostNport, token: self.connection.token })
                const tasksApi = new TasksAPI(influxDB)
                await tasksApi.patchTasksID({ taskID: self.task.id, body: { flux: contents } })
                vscode.commands.executeCommand('workbench.action.closeActiveEditor')
                listener.dispose()
                vscode.commands.executeCommand('influxdb.refresh')
            }
        })
        const edit = new vscode.WorkspaceEdit()
        edit.insert(newFile, new vscode.Position(0, 0), this.task.flux)
        const success = await vscode.workspace.applyEdit(edit)
        if (success) {
            vscode.window.showTextDocument(document)
        } else {
            vscode.window.showErrorMessage('Could not open task for editing.')
        }
    }

    // Delete the associated task
    public async deleteTask() : Promise<void> {
        const deleteText = 'Yes, delete it'
        const confirmation = await vscode.window.showInformationMessage(
            `Delete ${this.task.name}? This action cannot be undone.`, {
            modal: true
        }, deleteText)
        if (confirmation !== deleteText) {
            return
        }
        const influxDB = new InfluxDB({ url: this.connection.hostNport, token: this.connection.token })
        const tasksApi = new TasksAPI(influxDB)
        await tasksApi.deleteTasksID({ taskID: this.task.id })
        vscode.commands.executeCommand('influxdb.refresh')
    }
}
export class Tasks extends vscode.TreeItem {
    constructor(
        private connection : IConnection,
        private context : vscode.ExtensionContext
    ) {
        super(connection.name, vscode.TreeItemCollapsibleState.None)
        this.tooltip = `All tasks in ${this.connection.name}`
    }

    label = 'Tasks'
    collapsibleState = vscode.TreeItemCollapsibleState.Collapsed
    contextValue = 'tasks'

    getTreeItem() : Thenable<vscode.TreeItem> | vscode.TreeItem {
        return this
    }

    // XXX: rockstar (30 Aug 2021) - If the token isn't an "all access" token, we can't use it to fetch tasks.
    // We should tell the user this.
    async getChildren(_element?: ITreeNode) : Promise<ITreeNode[]> {
        const influxDB = new InfluxDB({ url: this.connection.hostNport, token: this.connection.token })
        const tasksApi = new TasksAPI(influxDB)
        const response = await tasksApi.getTasks()
        const nodes : ITreeNode[] = []
        if (response.tasks !== undefined) {
            // Why would this ever be undefined?
            response.tasks.forEach((task, _idx) => {
                nodes.push(new Task(this.connection, this.context, task))
            })
        }
        return nodes
    }

    // Add a new task
    public addTask() : void {
        const addTaskView = new AddTaskView(this.context)
        const panel = addTaskView.show(this.addTaskStepTwo.bind(this))
    }

    // The second step of the "Add task" flow, this task opens the task in and editor and handles save.
    private async addTaskStepTwo(name : string, offset : string, every : string | undefined, cron : string | undefined) : Promise<void> {
        let head = ''
        if (every !== undefined) {
            head = `option task = {name: "${name}", every: ${every}, offset: ${offset}}`
        } else {
            head = `option task = {name: "${name}", cron: ${cron}, offset: ${offset}}`
        }

        // XXX: rockstar (2 Sep 2021) - fs.rm doesn't exist until node 14.x, but the current
        // node environment is node 12.x. As such, we must create an entire dir to put the temp
        // file, and then remove the entire dir with fs.rmdir.
        const tmpdir = path.join(os.tmpdir(), crypto.randomBytes(10).toString('hex'))
        await fs.mkdir(tmpdir)
        const newFile = vscode.Uri.parse(path.join(tmpdir, `${name}.flux`))
        await fs.writeFile(newFile.path, '')
        const document = await vscode.workspace.openTextDocument(newFile.path)
        const self = this // eslint-disable-line @typescript-eslint/no-this-alias
        const saveListener = vscode.workspace.onDidSaveTextDocument(async (saved : vscode.TextDocument) : Promise<void> => {
            if (saved === document) {
                const saveText = 'Create and close'
                const confirmation = await vscode.window.showInformationMessage(
                    `Create ${name} task in ${self.connection.name}?`, {
                    modal: true
                }, saveText)
                if (confirmation !== saveText) {
                    return
                }
                const contents = saved.getText()
                const influxDB = new InfluxDB({ url: self.connection.hostNport, token: self.connection.token })
                const tasksApi = new TasksAPI(influxDB)
                await tasksApi.postTasks({ body: { org: self.connection.org, flux: contents } })
                vscode.commands.executeCommand('workbench.action.closeActiveEditor')
                saveListener.dispose()
                await fs.rmdir(tmpdir, { recursive: true })
                vscode.commands.executeCommand('influxdb.refresh')
            }
        })
        const closeListener = vscode.workspace.onDidCloseTextDocument(async (closed : vscode.TextDocument) : Promise<void> => {
            if (closed === document) {
                closeListener.dispose()
                saveListener.dispose()
                await fs.rmdir(tmpdir, { recursive: true })
                vscode.commands.executeCommand('influxdb.refresh')
            }
        })
        const edit = new vscode.WorkspaceEdit()
        edit.insert(newFile, new vscode.Position(0, 0), `${head}\n\n`)
        const success = await vscode.workspace.applyEdit(edit)
        if (success) {
            vscode.window.showTextDocument(document)
        } else {
            vscode.window.showErrorMessage('Could not open task for editing.')
        }
    }
}
export class Connection extends vscode.TreeItem {
    constructor(
        private connection : IConnection,
        private context : vscode.ExtensionContext,
        private parent : InfluxDBTreeProvider
    ) {
        super(connection.name, vscode.TreeItemCollapsibleState.None)
    }

    private get status() : string {
        return this.connection.isActive ? '' : '-gray'
    }

    getTreeItem() : Thenable<vscode.TreeItem> | vscode.TreeItem {
        let version = '2.x'
        if (this.connection.version === InfluxConnectionVersion.V1) {
            version = '1.x'
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
        const children : ITreeNode[] = [new Buckets(this.connection, this.context)]
        if (this.connection.version === InfluxConnectionVersion.V2) {
            children.push(new Tasks(this.connection, this.context))
        }
        return children
    }

    public async removeConnection(_node : Connection) : Promise<void> {
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

    public async editConnection() : Promise<void> {
        const view = new ConnectionView(this.context, this.parent)
        await view.edit(this.connection)
    }

    // XXX: rockstar (27 Aug 2021) - This should live on a ConnectionModel of some sort.
    // Set the currently active connection.
    public async activate() : Promise<void> {
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
        const connections = this.context.globalState.get<{ [key : string] : IConnection }>(InfluxDBConnectionsKey) || {}
        const nodes = []
        for (const [id, connection] of Object.entries(connections)) {
            let version = '2.x'
            if (connection.version === InfluxConnectionVersion.V1) {
                version = '1.x'
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
    ) : Promise<void> {
        panel.webview.onDidReceiveMessage(async (message : Message) => {
            const connection = convertMessageToConnection(message, uuid())
            switch (message.command) {
                case MessageType.Save: {
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
                }
                case MessageType.Test: {
                    try {
                        // TODO: handle 1.x connections
                        const queryApi = new InfluxDB({ url: connection.hostNport, token: connection.token }).getQueryApi(connection.org)
                        const query = 'buckets()'
                        const self = this // eslint-disable-line @typescript-eslint/no-this-alias
                        const children : Measurement[] = []
                        queryApi.queryRows(query, {
                            next(_row : string[], _tableMeta : FluxTableMetaData) { }, // eslint-disable-line @typescript-eslint/no-empty-function
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
                }
                default:
                    console.error(`Unhandled message type: ${message.command}`)
            }
        }, null)
    }
}
