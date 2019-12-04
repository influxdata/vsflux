// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

import { Client } from "./components/Client";
import { Executables } from "./executables/Tool";
import { Connection } from "./components/Connection";

let client: Client;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  const lspVersion = "0.0.3";

  // The server is implemented in rust
  let lspExe = await Executables.getLSP(context, lspVersion);
  if (lspExe === "") {
    return;
  }

  let logFilePath = "/tmp/lsp.log";
  if (process.platform === "win32") {
    logFilePath = context.extensionPath + "/lsp.log";
  }

  let influxCliPath = "influx";
  const conn = new Connection(influxCliPath);
  conn.load(context);

  client = new Client(lspExe, logFilePath);
  client.start(context);
}

// this method is called when your extension is deactivated
export function deactivate(): Thenable<void> | undefined {
  return client.stop();
}
