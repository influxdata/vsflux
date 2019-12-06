// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { ExtensionContext } from "vscode";

import { Client } from "./components/Client";
import { Connection } from "./components/connections/Connection";

let client: Client;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: ExtensionContext): Promise<void> {
  let logFilePath = "/tmp/lsp.log";
  if (process.platform === "win32") {
    logFilePath = context.extensionPath + "/lsp.log";
  }

  new Connection(context).load();

  client = new Client(logFilePath, context);
  client.start();
}

// this method is called when your extension is deactivated
export function deactivate(): Thenable<void> | undefined {
  return client.stop();
}
