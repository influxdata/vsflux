// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { ExtensionContext } from 'vscode'

import { Client } from './components/Client'
import { Status } from './components/connections/Status'
import { Connection, InfluxDBConnection, InfluxDBTreeDataProvider } from './components/connections/Connection'
import { InfluxDBConnectionsKey } from './components/connections/ConnectionNode'

let client: Client

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate (context: ExtensionContext) {
	
  InfluxDBTreeDataProvider.init(context)
  Connection.load(context)

  client = new Client(context)
  client.start()
}

// this method is called when your extension is deactivated
export async function deactivate () {
  await client.stop()
}
