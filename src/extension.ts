// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

import { Client } from "./Client";
import { ServerLoader } from "./ServerLoader";

let client: Client;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // The server is implemented in rust
  const lspPath = `${context.globalStoragePath}/flux-lsp`
  const logFilePath = "/tmp/lsp.log"

  const serverLoader = new ServerLoader(context)
  serverLoader.download().then(() => {
    client = new Client(lspPath, logFilePath)
    client.start(context)
  })
}

// this method is called when your extension is deactivated
export function deactivate(): Thenable<void> | undefined {
  return client.stop();
}
