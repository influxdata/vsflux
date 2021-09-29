import { InfluxDB, FluxTableMetaData, QueryApi } from '@influxdata/influxdb-client'
import { TasksAPI, Task as TaskModel, BucketsAPI, RetentionRule, OrgsAPI } from '@influxdata/influxdb-client-apis'
import * as InfluxDB1 from 'influx'
import { v1 as uuid } from 'uuid'
import * as vscode from 'vscode'
import * as path from 'path'
import * as os from 'os'
import * as crypto from 'crypto'
import { promises as fs } from 'fs'

import { Store } from '../components/Store'
import { ConnectionView } from './AddEditConnectionView'
import { AddBucketView } from './AddBucketView'
import { AddTaskView } from './AddTaskView'
import { IConnection, InfluxConnectionVersion } from '../types'

const version = vscode.extensions.getExtension('influxdata.flux')?.packageJSON.version
const headers = {
    'User-agent': `influxdb-client-vscode/${version}`
}

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
    readonly connDisableTLS : boolean;
}

function convertMessageToConnection(
    message : Message
) : IConnection {
    let isActive = false
    if (message.connID !== '') {
        const store = Store.getStore()
        const connection = store.getConnection(message.connID)
        isActive = connection.isActive
    }
    return {
        version:
            message.connVersion > 0
                ? InfluxConnectionVersion.V1
                : InfluxConnectionVersion.V2,
        id: message.connID || uuid(),
        name: message.connName,
        hostNport: message.connHost,
        token: message.connToken,
        org: message.connOrg,
        user: message.connUser,
        pass: message.connPass,
        isActive,
        disableTLS: message.connDisableTLS
    }
}

class BucketModel {
    constructor(
        readonly name : string,
        readonly id : string,
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

function connectionToClientV1(connection : IConnection) : InfluxDB1.InfluxDB {
    const hostSplit : string[] = vscode.Uri.parse(connection.hostNport).authority.split(':')
    if (hostSplit.length > 1) {
        return new InfluxDB1.InfluxDB({
            host: hostSplit[0], port: parseInt(hostSplit[1]), username: connection.user, password: connection.pass
        })
    } else {
        return new InfluxDB1.InfluxDB({
            host: hostSplit[0], username: connection.user, password: connection.pass
        })
    }
}
function connectionToClient(connection : IConnection) : InfluxDB {
    const transportOptions = { rejectUnauthorized: true }
    if (connection.disableTLS !== undefined && connection.disableTLS) {
        transportOptions.rejectUnauthorized = false
    }
    return new InfluxDB({ url: connection.hostNport, token: connection.token, transportOptions })
}
function connectionToQueryApi(connection : IConnection) : QueryApi {
    return connectionToClient(connection).getQueryApi({
        org: connection.org,
        headers: headers
    })
}
function connectionToTasksApi(connection : IConnection) : TasksAPI {
    return new TasksAPI(connectionToClient(connection))
}
function connectionToBucketsApi(connection : IConnection) : BucketsAPI {
    return new BucketsAPI(connectionToClient(connection))
}
function connectionToOrgsApi(connection : IConnection) : OrgsAPI {
    return new OrgsAPI(connectionToClient(connection))
}

interface ITreeNode {
    getTreeItem() : Thenable<vscode.TreeItem> | vscode.TreeItem;
    getChildren(element?: ITreeNode) : Thenable<ITreeNode[]> | ITreeNode[];
}
class Tag extends vscode.TreeItem {
    constructor(
        private connection : IConnection,
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
    private HIDDEN_MEASUREMENTS = ['_start', '_stop', '_measurement']

    constructor(
        private connection : IConnection,
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
        const queryApi = connectionToQueryApi(this.connection)
        const query = `import "influxdata/influxdb/schema"
schema.measurementTagKeys(bucket: "${this.measurement.bucket.name}", measurement: "${this.measurement.name}")`
        const self = this // eslint-disable-line @typescript-eslint/no-this-alias
        return new Promise((resolve, reject) => {
            const children : Tag[] = []
            queryApi.queryRows(query, {
                next(row : string[], tableMeta : FluxTableMetaData) {
                    const object = tableMeta.toObject(row)
                    if (self.HIDDEN_MEASUREMENTS.includes(object._value)) {
                        return
                    }
                    const tag = new MeasurementTagModel(object._value, self.measurement)
                    const node = new Tag(self.connection, tag)
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
export class Bucket extends vscode.TreeItem {
    constructor(
        private connection : IConnection,
        private bucket : BucketModel
    ) {
        super(connection.name, vscode.TreeItemCollapsibleState.Collapsed)
    }

    getTreeItem() : Thenable<vscode.TreeItem> | vscode.TreeItem {
        const state = (this.connection.version === InfluxConnectionVersion.V2 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None)
        return {
            label: this.bucket.name,
            collapsibleState: state,
            contextValue: 'bucket'
        }
    }

    async getChildren(_element?: ITreeNode) : Promise<ITreeNode[]> {
        if (this.connection.version === InfluxConnectionVersion.V2) {
            const queryApi = connectionToQueryApi(this.connection)
            const query = `import "influxdata/influxdb/schema"
schema.measurements(bucket: "${this.bucket.name}")`
            const self = this // eslint-disable-line @typescript-eslint/no-this-alias
            return new Promise((resolve, reject) => {
                const children : Measurement[] = []
                queryApi.queryRows(query, {
                    next(row : string[], tableMeta : FluxTableMetaData) {
                        const object = tableMeta.toObject(row)
                        const measurement = new MeasurementModel(object._value, self.bucket)
                        const node = new Measurement(self.connection, measurement)
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
        } else {
            console.error('Attempt to get measurements in InfluxDB 1.x')
            return []
        }
    }

    public async deleteBucket() : Promise<void> {
        const bucketsApi = connectionToBucketsApi(this.connection)
        await bucketsApi.deleteBucketsID({ bucketID: this.bucket.id }, { headers })
        vscode.commands.executeCommand('influxdb.refresh')
    }
}
export class Buckets extends vscode.TreeItem {
    label = 'Buckets'
    collapsibleState = vscode.TreeItemCollapsibleState.Collapsed
    contextValue = 'buckets'

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

    async getChildren(_element?: ITreeNode) : Promise<ITreeNode[]> {
        if (this.connection.version === InfluxConnectionVersion.V2) {
            const queryApi = connectionToQueryApi(this.connection)
            const query = 'buckets()'
            const self = this // eslint-disable-line @typescript-eslint/no-this-alias
            return new Promise((resolve, reject) => {
                const children : Bucket[] = []
                queryApi.queryRows(query, {
                    next(row : string[], tableMeta : FluxTableMetaData) {
                        const object = tableMeta.toObject(row)
                        const bucket = new BucketModel(object.name, object.id, object.retentionPeriod, object.retentionPolicy)
                        const node = new Bucket(self.connection, bucket)
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
        } else {
            const queryApi = connectionToClientV1(this.connection)
            try {
                const databases = await queryApi.getDatabaseNames()
                const children : Bucket[] = []
                for (const index in databases) {
                    const bucket = new BucketModel(databases[index], '', 0, '')
                    const node = new Bucket(this.connection, bucket)
                    children.push(node)
                }
                return children
            } catch (e) {
                console.error(e)
                return []
            }
        }
    }

    public addBucket() : void {
        const addBucketView = new AddBucketView(this.context)
        const panel = addBucketView.show(this.addBucketCallback.bind(this))
    }

    private async addBucketCallback(name : string, duration : number | undefined) : Promise<void> {
        // XXX: rockstar (13 Sep 2021) - This makes me irrationally annoyed. The
        // postBuckets api requires an orgID, not an org, so we have to fetch
        // the orgID in order to create the bucket. The api clients are just very
        // inconsistent.
        const orgsAPI = connectionToOrgsApi(this.connection)
        const organizations = await orgsAPI.getOrgs({ org: this.connection.org }, { headers })
        if (!organizations || !organizations.orgs || !organizations.orgs.length || organizations.orgs[0].id === undefined) {
            console.error(`No organization named "${this.connection.org}" found!`)
            vscode.window.showErrorMessage('Unexpected error creating bucket')
            return
        }
        const orgID = organizations.orgs[0].id

        const bucketsApi = connectionToBucketsApi(this.connection)
        const retentionRules : RetentionRule[] = []
        if (duration !== undefined) {
            retentionRules.push({ type: 'expire', shardGroupDurationSeconds: 0, everySeconds: duration })
        }
        await bucketsApi.postBuckets({
            body: {
                orgID,
                name,
                retentionRules
            }
        }, { headers })
        vscode.commands.executeCommand('influxdb.refresh')
    }
}
export class Task extends vscode.TreeItem {
    constructor(
        private connection : IConnection,
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
        // XXX: rockstar (3 Sep 2021) - fs.rm doesn't exist until node 14.x, but the current
        // node environment is node 12.x. As such, we must create an entire dir to put the temp
        // file, and then remove the entire dir with fs.rmdir.
        const tmpdir = path.join(os.tmpdir(), crypto.randomBytes(10).toString('hex'))
        await fs.mkdir(tmpdir)
        const newFile = vscode.Uri.parse(path.join(tmpdir, `${this.task.name}.flux`))
        await fs.writeFile(newFile.path, '')
        const document = await vscode.workspace.openTextDocument(newFile.path)
        const self = this // eslint-disable-line @typescript-eslint/no-this-alias
        const saveListener = vscode.workspace.onWillSaveTextDocument(async (event_ : vscode.TextDocumentWillSaveEvent) => {
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
                const tasksApi = connectionToTasksApi(self.connection)
                await tasksApi.patchTasksID({ taskID: self.task.id, body: { flux: contents } }, { headers: headers })
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
        const tasksApi = connectionToTasksApi(this.connection)
        await tasksApi.deleteTasksID({ taskID: this.task.id }, { headers: headers })
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
        const tasksApi = connectionToTasksApi(this.connection)
        const response = await tasksApi.getTasks(undefined, { headers: headers })
        const nodes : ITreeNode[] = []
        if (response.tasks !== undefined) {
            // Why would this ever be undefined?
            response.tasks.forEach((task, _idx) => {
                nodes.push(new Task(this.connection, task))
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
                const tasksApi = connectionToTasksApi(self.connection)
                await tasksApi.postTasks({ body: { org: self.connection.org, flux: contents } }, { headers: headers })
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
        const store = Store.getStore()
        await store.deleteConnection(this.connection.id)
        vscode.commands.executeCommand('influxdb.refresh')
    }

    public async editConnection() : Promise<void> {
        const view = new ConnectionView(this.context, this.parent)
        await view.edit(this.connection)
    }

    // XXX: rockstar (27 Aug 2021) - This should live on a ConnectionModel of some sort.
    // Set the currently active connection.
    public async activate() : Promise<void> {
        const store = Store.getStore()
        const connection = store.getConnection(this.connection.id)
        connection.isActive = true
        await store.saveConnection(connection)

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
        const connections = Store.getStore().getConnections()
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
            const connection = convertMessageToConnection(message)
            switch (message.command) {
                case MessageType.Save: {
                    const store = Store.getStore()
                    await store.saveConnection(connection)

                    vscode.commands.executeCommand('influxdb.refresh')
                    panel.dispose()
                    break
                }
                case MessageType.Test: {
                    if (connection.version === InfluxConnectionVersion.V2) {
                        try {
                            const queryApi = connectionToQueryApi(connection)
                            const query = 'buckets()'
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
                    } else {
                        const queryApi = connectionToClientV1(connection)
                        try {
                            await queryApi.getDatabaseNames()
                            vscode.window.showInformationMessage('Connection successful')
                        } catch (e) {
                            vscode.window.showErrorMessage('Failed to connect to database')
                            console.error(e)
                        }
                    }
                    break
                }
                default:
                    console.error(`Unhandled message type: ${message.command}`)
            }
        }, null)
    }
}
