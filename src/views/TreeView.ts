import { FluxTableMetaData } from '@influxdata/influxdb-client'
import { Script as ScriptModel, Task as TaskModel } from '@influxdata/influxdb-client-apis'
import * as vscode from 'vscode'
import * as path from 'path'
import * as os from 'os'
import * as crypto from 'crypto'
import { promises as fs } from 'fs'

import { Store } from '../components/Store'
import { AddTaskView } from './AddTaskView'
import { TableView } from '../views/TableView'
import { IInstance } from '../types'
import { APIClient } from '../components/APIClient'
import { AddScriptController } from '../controllers/AddScriptController'
import { AddInstanceController } from '../controllers/AddInstanceController'
import { QueryResult } from '../models'

const LIMIT = 500

const version = vscode.extensions.getExtension('influxdata.flux')?.packageJSON.version
const headers = {
    'User-agent': `influxdb-client-vscode/${version}`
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
class MeasurementFieldModel {
    constructor(
        readonly name : string,
        private measurement : MeasurementModel
    ) { }
}
class MeasurementTagModel {
    constructor(
        readonly name : string,
        readonly measurement : MeasurementModel
    ) { }
}
class MeasurementTagValueModel {
    constructor(
        readonly name : string,
        private tag : MeasurementTagModel
    ) { }
}

interface ITreeNode {
    getTreeItem() : Thenable<vscode.TreeItem> | vscode.TreeItem;
    getChildren(element ?: ITreeNode) : Thenable<ITreeNode[]> | ITreeNode[];
}
class TagValue extends vscode.TreeItem {
    constructor(
        private instance : IInstance,
        private tagValue : MeasurementTagValueModel
    ) {
        super(tagValue.name, vscode.TreeItemCollapsibleState.None)
    }

    getTreeItem() : Thenable<vscode.TreeItem> | vscode.TreeItem {
        return {
            label: this.tagValue.name,
            collapsibleState: vscode.TreeItemCollapsibleState.None
        }
    }

    getChildren(_element ?: ITreeNode) : Thenable<ITreeNode[]> | ITreeNode[] {
        return []
    }
}
class Tag extends vscode.TreeItem {
    constructor(
        private instance : IInstance,
        private tag : MeasurementTagModel
    ) {
        super(tag.name, vscode.TreeItemCollapsibleState.Collapsed)
    }

    getTreeItem() : Thenable<vscode.TreeItem> | vscode.TreeItem {
        return {
            label: this.tag.name,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed
        }
    }

    getChildren(_element ?: ITreeNode) : Thenable<ITreeNode[]> | ITreeNode[] {
        const queryApi = new APIClient(this.instance).getQueryApi()
        const query = `import "influxdata/influxdb/schema"
schema.measurementTagValues(bucket: "${this.tag.measurement.bucket.name}", measurement: "${this.tag.measurement.name}", tag: "${this.tag.name}")`
        const self = this // eslint-disable-line @typescript-eslint/no-this-alias
        return new Promise((resolve, reject) => {
            const children : TagValue[] = []
            queryApi.queryRows(query, {
                next(row : string[], tableMeta : FluxTableMetaData) {
                    const object = tableMeta.toObject(row)
                    const tag = new MeasurementTagValueModel(object._value, self.tag)
                    const node = new TagValue(self.instance, tag)
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
class Tags extends vscode.TreeItem {
    constructor(
        private instance : IInstance,
        private measurement : MeasurementModel
    ) {
        super('Tags', vscode.TreeItemCollapsibleState.Collapsed)
    }

    getTreeItem() : Thenable<vscode.TreeItem> | vscode.TreeItem {
        return {
            label: 'Tags',
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed
        }
    }

    getChildren(_element ?: ITreeNode) : Thenable<ITreeNode[]> | ITreeNode[] {
        const queryApi = new APIClient(this.instance).getQueryApi()
        const query = `import "influxdata/influxdb/schema"
schema.measurementTagKeys(bucket: "${this.measurement.bucket.name}", measurement: "${this.measurement.name}")`
        const self = this // eslint-disable-line @typescript-eslint/no-this-alias
        return new Promise((resolve, reject) => {
            const children : Tag[] = []
            queryApi.queryRows(query, {
                next(row : string[], tableMeta : FluxTableMetaData) {
                    const object = tableMeta.toObject(row)
                    if (object._value.startsWith('_')) { return }
                    const tag = new MeasurementTagModel(object._value, self.measurement)
                    const node = new Tag(self.instance, tag)
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
class Field extends vscode.TreeItem {
    constructor(
        private instance : IInstance,
        private field : MeasurementFieldModel
    ) {
        super(instance.name, vscode.TreeItemCollapsibleState.None)
    }

    getTreeItem() : Thenable<vscode.TreeItem> | vscode.TreeItem {
        return {
            label: this.field.name,
            collapsibleState: vscode.TreeItemCollapsibleState.None
        }
    }

    getChildren(_element ?: ITreeNode) : Thenable<ITreeNode[]> | ITreeNode[] {
        return []
    }
}
class Fields extends vscode.TreeItem {
    private HIDDEN_MEASUREMENTS = ['_start', '_stop', '_measurement']

    constructor(
        private instance : IInstance,
        private measurement : MeasurementModel
    ) {
        super('Fields', vscode.TreeItemCollapsibleState.Collapsed)
    }

    getTreeItem() : Thenable<vscode.TreeItem> | vscode.TreeItem {
        return {
            label: 'Fields',
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed
        }
    }

    getChildren(_element ?: ITreeNode) : Thenable<ITreeNode[]> | ITreeNode[] {
        const queryApi = new APIClient(this.instance).getQueryApi()
        const query = `import "influxdata/influxdb/schema"
schema.measurementFieldKeys(bucket: "${this.measurement.bucket.name}", measurement: "${this.measurement.name}")`
        const self = this // eslint-disable-line @typescript-eslint/no-this-alias
        return new Promise((resolve, reject) => {
            const children : Field[] = []
            queryApi.queryRows(query, {
                next(row : string[], tableMeta : FluxTableMetaData) {
                    const object = tableMeta.toObject(row)
                    if (self.HIDDEN_MEASUREMENTS.includes(object._value)) {
                        return
                    }
                    const field = new MeasurementFieldModel(object._value, self.measurement)
                    const node = new Field(self.instance, field)
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
class Measurement extends vscode.TreeItem {
    constructor(
        private instance : IInstance,
        private measurement : MeasurementModel
    ) {
        super(instance.name, vscode.TreeItemCollapsibleState.Collapsed)
    }

    getTreeItem() : Thenable<vscode.TreeItem> | vscode.TreeItem {
        return {
            label: this.measurement.name,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed
        }
    }

    getChildren(_element ?: ITreeNode) : Thenable<ITreeNode[]> | ITreeNode[] {
        return [
            new Fields(this.instance, this.measurement),
            new Tags(this.instance, this.measurement)
        ]
    }
}
export class Bucket extends vscode.TreeItem {
    constructor(
        private instance : IInstance,
        private bucket : BucketModel
    ) {
        super(instance.name, vscode.TreeItemCollapsibleState.Collapsed)
    }

    getTreeItem() : Thenable<vscode.TreeItem> | vscode.TreeItem {
        return {
            label: this.bucket.name,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextValue: 'bucket'
        }
    }

    async getChildren(_element ?: ITreeNode) : Promise<ITreeNode[]> {
        const queryApi = new APIClient(this.instance).getQueryApi()
        const query = `import "influxdata/influxdb/schema"
schema.measurements(bucket: "${this.bucket.name}")`
        const self = this // eslint-disable-line @typescript-eslint/no-this-alias
        return new Promise((resolve, reject) => {
            const children : Measurement[] = []
            queryApi.queryRows(query, {
                next(row : string[], tableMeta : FluxTableMetaData) {
                    const object = tableMeta.toObject(row)
                    const measurement = new MeasurementModel(object._value, self.bucket)
                    const node = new Measurement(self.instance, measurement)
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

    public async deleteBucket() : Promise<void> {
        const bucketsApi = new APIClient(this.instance).getBucketsApi()
        await bucketsApi.deleteBucketsID({ bucketID: this.bucket.id }, { headers })
        vscode.commands.executeCommand('influxdb.refresh')
    }
}
export class Buckets extends vscode.TreeItem {
    label = 'Buckets'
    collapsibleState = vscode.TreeItemCollapsibleState.Collapsed
    contextValue = 'buckets'

    constructor(
        readonly instance : IInstance,
        private context : vscode.ExtensionContext
    ) {
        super(instance.name, vscode.TreeItemCollapsibleState.None)
        this.tooltip = `All buckets in ${this.instance.name}`
    }

    getTreeItem() : Thenable<vscode.TreeItem> | vscode.TreeItem {
        return this
    }

    async getChildren(_element ?: ITreeNode) : Promise<ITreeNode[]> {
        const queryApi = new APIClient(this.instance).getQueryApi()
        const query = 'buckets()'
        const self = this // eslint-disable-line @typescript-eslint/no-this-alias
        return new Promise((resolve, reject) => {
            const children : Bucket[] = []
            queryApi.queryRows(query, {
                next(row : string[], tableMeta : FluxTableMetaData) {
                    const object = tableMeta.toObject(row)
                    const bucket = new BucketModel(object.name, object.id, object.retentionPeriod, object.retentionPolicy)
                    const node = new Bucket(self.instance, bucket)
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
        private instance : IInstance,
        private task : TaskModel
    ) {
        super(instance.name, vscode.TreeItemCollapsibleState.None)
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

    getChildren(_element ?: ITreeNode) : Thenable<ITreeNode[]> | ITreeNode[] {
        return []
    }

    public async editTask() : Promise<void> {
        // Refetch the task, as it may be stale.
        const scriptsAPI = new APIClient(this.instance).getTasksApi()
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.task = await scriptsAPI.getTasksID({ taskID: this.task.id! })

        // XXX: rockstar (3 Sep 2021) - fs.rm doesn't exist until node 14.x, but the current
        // node environment is node 12.x. As such, we must create an entire dir to put the temp
        // file, and then remove the entire dir with fs.rmdir.
        const tmpdir = path.join(os.tmpdir(), crypto.randomBytes(10).toString('hex'))
        await fs.mkdir(tmpdir)
        const newFile = vscode.Uri.parse(path.join(tmpdir, `${this.task.name.replace(path.sep, '-')}.flux`))
        await fs.writeFile(newFile.path, '')
        const document = await vscode.workspace.openTextDocument(newFile.path)
        const self = this // eslint-disable-line @typescript-eslint/no-this-alias
        const saveListener = vscode.workspace.onWillSaveTextDocument(async (event_ : vscode.TextDocumentWillSaveEvent) => {
            if (event_.document === document) {
                const saveText = 'Save and close'
                const confirmation = await vscode.window.showInformationMessage(
                    `Save remote task ${self.task.name} to ${self.instance.name}?`, {
                    modal: true
                }, saveText)
                if (confirmation !== saveText) {
                    return
                }
                const contents = event_.document.getText()
                const tasksApi = new APIClient(self.instance).getTasksApi()
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
        const tasksApi = new APIClient(this.instance).getTasksApi()
        await tasksApi.deleteTasksID({ taskID: this.task.id }, { headers: headers })
        vscode.commands.executeCommand('influxdb.refresh')
    }

    public async renameTask() : Promise<void> {
        try {
            const scriptsAPI = new APIClient(this.instance).getTasksApi()
            const name = await vscode.window.showInputBox({
                title: 'Rename task',
                prompt: 'Enter the new name of the task'
            })
            await scriptsAPI.patchTasksID({
                taskID: this.task.id!, // eslint-disable-line @typescript-eslint/no-non-null-assertion
                body: {
                    name
                }
            })
            await vscode.commands.executeCommand('influxdb.refresh')
        } catch (e) {
            vscode.window.showErrorMessage(`Could not rename task. Got error: ${e}`)
        }
    }
}
export class Tasks extends vscode.TreeItem {
    constructor(
        readonly instance : IInstance,
        private context : vscode.ExtensionContext
    ) {
        super(instance.name, vscode.TreeItemCollapsibleState.None)
        this.tooltip = `All tasks in ${this.instance.name}`
    }

    label = 'Tasks'
    collapsibleState = vscode.TreeItemCollapsibleState.Collapsed
    contextValue = 'tasks'

    getTreeItem() : Thenable<vscode.TreeItem> | vscode.TreeItem {
        return this
    }

    // XXX: rockstar (30 Aug 2021) - If the token isn't an "all access" token, we can't use it to fetch tasks.
    // We should tell the user this.
    async getChildren(_element ?: ITreeNode) : Promise<ITreeNode[]> {
        const tasksApi = new APIClient(this.instance).getTasksApi()
        const nodes : ITreeNode[] = []

        let after
        while (true) {
            const response = await tasksApi.getTasks({ after: after, limit: LIMIT }, { headers: headers })
            if (response.tasks !== undefined && response.tasks.length > 0) {
                response.tasks.forEach((task, _idx) => {
                    nodes.push(new Task(this.instance, task))
                    after = task.id
                })
            } else {
                break
            }
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
        const newFile = vscode.Uri.parse(path.join(tmpdir, `${name.replace(path.sep, '-')}.flux`))
        await fs.writeFile(newFile.path, '')
        const document = await vscode.workspace.openTextDocument(newFile.path)
        const self = this // eslint-disable-line @typescript-eslint/no-this-alias
        const saveListener = vscode.workspace.onDidSaveTextDocument(async (saved : vscode.TextDocument) : Promise<void> => {
            try {
                if (saved === document) {
                    const saveText = 'Create and close'
                    const confirmation = await vscode.window.showInformationMessage(
                        `Create ${name} task in ${self.instance.name}?`, {
                        modal: true
                    }, saveText)
                    if (confirmation !== saveText) {
                        return
                    }
                    const contents = saved.getText()
                    const tasksApi = new APIClient(self.instance).getTasksApi()
                    await tasksApi.postTasks({ body: { org: self.instance.org, flux: contents } }, { headers: headers })
                    vscode.commands.executeCommand('workbench.action.closeActiveEditor')
                    saveListener.dispose()
                    await fs.rmdir(tmpdir, { recursive: true })
                    vscode.commands.executeCommand('influxdb.refresh')
                }
            } catch (e) {
                console.error(e)
                if (e instanceof Error) {
                    vscode.window.showErrorMessage(`Unable to create task: ${e}`)
                }
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
export class Scripts extends vscode.TreeItem {
    constructor(
        readonly instance : IInstance,
        private context : vscode.ExtensionContext
    ) {
        super(instance.name, vscode.TreeItemCollapsibleState.None)
        this.tooltip = `All invocable scripts in ${this.instance.name}`
    }

    label = 'Scripts'
    collapsibleState = vscode.TreeItemCollapsibleState.Collapsed
    contextValue = 'scripts'

    getTreeItem() : Thenable<vscode.TreeItem> | vscode.TreeItem {
        return this
    }

    async getChildren(_element ?: ITreeNode) : Promise<ITreeNode[]> {
        const scriptsApi = new APIClient(this.instance).getScriptsApi()
        const nodes : ITreeNode[] = []

        let offset = 0
        while (true) {
            const response = await scriptsApi.getScripts({ offset: offset, limit: LIMIT })
            if (response.scripts !== undefined && response.scripts.length > 0) {
                response.scripts.forEach((script, _idx) => {
                    nodes.push(new Script(this.instance, this.context, script))
                })
                offset = offset + response.scripts.length
            } else {
                break
            }
        }
        return nodes
    }
}
export class Script extends vscode.TreeItem {
    constructor(
        private instance : IInstance,
        private context : vscode.ExtensionContext,
        private script : ScriptModel
    ) {
        super(instance.name, vscode.TreeItemCollapsibleState.None)
    }

    getTreeItem() : Thenable<vscode.TreeItem> | vscode.TreeItem {
        return {
            label: this.script.name,
            description: this.script.language,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextValue: 'script'
        }
    }

    getChildren(_element ?: ITreeNode) : Thenable<ITreeNode[]> | ITreeNode[] {
        return []
    }

    public async renameScript() : Promise<void> {
        try {
            const scriptsAPI = new APIClient(this.instance).getScriptsApi()
            const name = await vscode.window.showInputBox({
                title: 'Rename script',
                prompt: 'Enter the new name of the script'
            })
            await scriptsAPI.patchScriptsID({
                scriptID: this.script.id!, // eslint-disable-line @typescript-eslint/no-non-null-assertion
                body: {
                    name
                }
            })
            await vscode.commands.executeCommand('influxdb.refresh')
        } catch (e) {
            vscode.window.showErrorMessage(`Could not rename script. Got error: ${e}`)
        }
    }

    public async editScript() : Promise<void> {
        const controller = new AddScriptController(this.instance, this.context)

        // Refetch the script, as it may be stale.
        const scriptsAPI = new APIClient(this.instance).getScriptsApi()
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.script = await scriptsAPI.getScriptsID({ scriptID: this.script.id! })

        await controller.editScript(this.script)
    }

    public async invokeScript() : Promise<void> {
        const scriptsApi = new APIClient(this.instance).getScriptInvocationApi()
        try {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const results = await QueryResult.invokeScript(scriptsApi, this.script.id!)
            const tableView = new TableView(this.context)
            tableView.show(results, this.instance.name)
            vscode.window.showInformationMessage('Script invoked successfully.')
        } catch (e) {
            vscode.window.showErrorMessage(`Could not invoke script. Got error: ${e}`)
        }
    }

    public async deleteScript() : Promise<void> {
        const deleteText = 'Yes, delete it'
        const confirmation = await vscode.window.showInformationMessage(
            `Delete ${this.script.name}? This action cannot be undone.`, {
            modal: true
        }, deleteText)
        if (confirmation !== deleteText) {
            return
        }
        const scriptsApi = new APIClient(this.instance).getScriptsApi()
        if (this.script.id !== undefined) {
            // This should never be undefined.
            try {
                await scriptsApi.deleteScriptsID({ scriptID: this.script.id })
            } catch (error) {
                // XXX: rockstar (21 Oct 2021) - *Something* is trying to parse JSON now, and it
                // seems to coincide with the change from `v2/functions/...` to `v2/scripts/...`. As
                // the current `ScriptsApi` is temporary (see file), workaround it for now.
            }
        }
        vscode.commands.executeCommand('influxdb.refresh')
    }

    public async copyResourceID() : Promise<void> {
        if (this.script.id === undefined) {
            // Scripts are persisted before being presented to the UI. This should never be undefined.
            console.error('tried to copy id of script without an id!')
            return
        }
        await vscode.env.clipboard.writeText(this.script.id)
        await vscode.window.showInformationMessage(`ID for Script '${this.script.name}' copied to clipboard!`)
    }
}

export class Instance extends vscode.TreeItem {
    constructor(
        private instance : IInstance,
        private context : vscode.ExtensionContext,
        private parent : InfluxDBTreeProvider
    ) {
        super(instance.name, vscode.TreeItemCollapsibleState.None)
    }

    private get status() : string {
        return this.instance.isActive ? '' : '-gray'
    }

    getTreeItem() : Thenable<vscode.TreeItem> | vscode.TreeItem {
        return {
            label: this.instance.name,
            tooltip: `${this.instance.name}-${version}`,
            description: '2.x',
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            iconPath: this.context.asAbsolutePath(`resources/influx-logo${this.status}.svg`),
            contextValue: 'instance'
        }
    }

    async getChildren(_element ?: ITreeNode) : Promise<ITreeNode[]> {
        const children : ITreeNode[] = [new Buckets(this.instance, this.context)]
        try {
            const scriptsApi = new APIClient(this.instance).getScriptsApi()
            await scriptsApi.getScripts()
            children.push(new Scripts(this.instance, this.context))
        } catch (e) {
            console.debug('Scripts capability not available')
        }
        children.push(new Tasks(this.instance, this.context))
        return children
    }

    public async removeInstance(_node : Instance) : Promise<void> {
        const removeText = 'Yes, remove it'
        const confirmation = await vscode.window.showInformationMessage(
            `Remove instance to ${this.instance.name}`, {
            modal: true
        }, removeText
        )
        if (confirmation !== removeText) {
            return
        }
        const store = Store.getStore()
        await store.deleteInstance(this.instance.id)
        vscode.commands.executeCommand('influxdb.refresh')
    }

    public async editInstance() : Promise<void> {
        const _controller = new AddInstanceController(this.context, this.instance)
    }

    // XXX: rockstar (27 Aug 2021) - This should live on a InstanceModel of some sort.
    // Set the currently active instance.
    public async activate() : Promise<void> {
        const store = Store.getStore()
        const instance = await store.getInstance(this.instance.id)
        instance.isActive = true
        await store.saveInstance(instance)

        vscode.commands.executeCommand('influxdb.refresh')
    }
}

export class InfluxDBTreeProvider implements vscode.TreeDataProvider<ITreeNode> {
    constructor(private context : vscode.ExtensionContext) { }
    private _onDidChangeTreeData : vscode.EventEmitter<Instance | undefined | null | void> = new vscode.EventEmitter<Instance | undefined | null | void>()
    readonly onDidChangeTreeData : vscode.Event<Instance | undefined | null | void> = this._onDidChangeTreeData.event

    refresh() : void {
        this._onDidChangeTreeData.fire()
    }

    getTreeItem(element : ITreeNode) : Thenable<vscode.TreeItem> | vscode.TreeItem {
        return element.getTreeItem()
    }

    async getChildren(element ?: ITreeNode) : Promise<ITreeNode[]> {
        if (element) {
            return element.getChildren()
        }
        const instances = await Store.getStore().getInstances()
        const nodes = []
        for (const [id, instance] of Object.entries(instances)) {
            const node = new Instance(instance, this.context, this)
            nodes.push(node)
        }
        return nodes
    }
}
