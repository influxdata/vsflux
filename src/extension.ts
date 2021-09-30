// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'

import { Store } from './components/Store'
import { Client } from './components/Client'
import { activateDebug } from './components/Debug'
import { ConnectionView } from './views/AddEditConnectionView'
import { Bucket, Buckets, Connection, InfluxDBTreeProvider, Task, Tasks } from './views/TreeView'
import { runQuery } from './components/QueryRunner'

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
                runQuery(query, context)
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
