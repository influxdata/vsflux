// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { ExtensionContext } from 'vscode'

import { Client } from './components/Client'
import { Connection, InfluxDBTreeDataProvider } from './components/connections/Connection'

let languageClient : Client

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context : ExtensionContext) {
    languageClient = new Client(context)
    languageClient.start()

    const connection = new Connection(context)
    await connection.load()
}

// this method is called when your extension is deactivated
export async function deactivate() {
    await languageClient.stop()
}