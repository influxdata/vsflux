// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

import { Client } from "./components/Client";
import { Connection } from "./components/Connection";

let client: Client;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // The server is implemented in rust
  let lspPath = "flux-lsp";
  let influxCliPath = "influx";
  let logFilePath = "/tmp/lsp.log";

  const conn = new Connection(influxCliPath);
  conn.load(context);

  client = new Client(lspPath, logFilePath);
  client.start(context);
}

// this method is called when your extension is deactivated
export function deactivate(): Thenable<void> | undefined {
  return client.stop();
}
