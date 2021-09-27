// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'
import { InfluxDB } from '@influxdata/influxdb-client'

import { Store } from './components/Store'
import { Client } from './components/Client'
import { activateDebug } from './components/Debug'
import { ConnectionView } from './views/AddEditConnectionView'
import { Bucket, Buckets, Connection, InfluxDBTreeProvider, Task, Tasks } from './views/TreeView'
import { IConnection } from './types'
import { TableView } from './views/TableView'
import { QueryResult } from './models'

let languageClient : Client

const runMode : 'external' | 'server' | 'namedPipeServer' | 'inline' = 'inline'

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context : vscode.ExtensionContext) : Promise<void> {
    Store.init(context)
    switch (runMode) {
        case 'inline':
            activateDebug(context)
            break
        default:
            // We want to explicitly disallow these other run modes for now.
            vscode.window.showWarningMessage(`Unsupported debugger run mode: ${runMode}`)
            break
    }

    languageClient = new Client(context)
    languageClient.start()

    const treeProvider = new InfluxDBTreeProvider(context)
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider(
            'influxdb', treeProvider
        )
    )
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'influxdb.refresh', () => { treeProvider.refresh() }
        )
    )
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'influxdb.runQuery',
            // XXX: rockstar (26 Aug 2021) - This should really live in a controller of some sort,
            // but the current abstractions make it hard to see how that architecture should be.
            async () => {
                const { activeTextEditor } = vscode.window
                if (!activeTextEditor) {
                    return
                }
                let query = ''
                if (activeTextEditor.selection.isEmpty) {
                    query = activeTextEditor.document.getText()
                } else {
                    query = activeTextEditor.document.getText(activeTextEditor.selection)
                }
                if (!query) {
                    vscode.window.showWarningMessage('No flux file selected')
                    return
                }
                try {
                    const store = Store.getStore()
                    const connection = Object.values(store.getConnections()).filter((item : IConnection) => item.isActive)[0]
                    const transportOptions = { rejectUnauthorized: true }
                    if (connection.disableTLS !== undefined && connection.disableTLS) {
                        transportOptions.rejectUnauthorized = false
                    }
                    const queryApi = new InfluxDB({ url: connection.hostNport, token: connection.token, transportOptions }).getQueryApi(connection.org)
                    const results = await QueryResult.run(queryApi, query)
                    const tableView = new TableView(context)
                    tableView.show(results, connection.name)
                } catch (error) {
                    let errorMessage = 'Error executing query'
                    if (error instanceof Error) {
                        errorMessage = error.message
                    }
                    vscode.window.showErrorMessage(errorMessage)
                    console.error(error)
                }
            }
        )
    )
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'influxdb.addConnection',
            async () => {
                const addConnectionView = new ConnectionView(context, treeProvider)
                await addConnectionView.create()
            }
        )
    )
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'influxdb.removeConnection',
            async (node : Connection) => {
                node.removeConnection(node)
            }
        )
    )
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'influxdb.editConnection',
            async (node : Connection) => {
                node.editConnection()
            }
        )
    )
    // XXX: rockstar (30 Aug 2021) - This task should really be plumbed in when
    // the item is selected, as detailed in the `command?` property at
    // https://code.visualstudio.com/api/references/vscode-api#TreeItem
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'influxdb.editTask',
            async (node : Task) => {
                await node.editTask()
            }
        )
    )
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'influxdb.addBucket',
            async (node : Buckets) => {
                node.addBucket()
            }
        )
    )
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'influxdb.deleteBucket',
            async (node : Bucket) => {
                await node.deleteBucket()
            }
        )
    )

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'influxdb.addTask',
            async (node : Tasks) => {
                node.addTask()
            }
        )
    )
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'influxdb.deleteTask',
            async (node : Task) => {
                await node.deleteTask()
            }
        )
    )
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'influxdb.activateConnection',
            async (node : Connection) => {
                node.activate()
            }
        )
    )
}

// this method is called when your extension is deactivated
export async function deactivate() : Promise<void> {
    await languageClient.stop()
}
