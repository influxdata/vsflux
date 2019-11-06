// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as path from "path";
import { workspace, ExtensionContext } from "vscode";

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  Executable
} from "vscode-languageclient";

let client: LanguageClient;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "flux" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand("extension.runFlux", () => {
    // The code you place here will be executed every time your command is executed

    // Display a message box to the user
    vscode.window.showInformationMessage("flux runned!");
    console.log("ok runned flux");
  });

  context.subscriptions.push(disposable);
  // The server is implemented in rust
  let cmd = "/usr/local/sbin/flux-lsp";
  let debugArgs = ["-l", "/tmp/lsp.log"];

  let serverOptions: ServerOptions = {
    run: {
      command: cmd
    },
    debug: {
      command: cmd,
      args: debugArgs
    }
  };

  // Options to control the language client
  let clientOptions: LanguageClientOptions = {
    // Register the server for flux documents
    documentSelector: [{ scheme: "file", language: "flux" }],
    synchronize: {
      // Notify the server about file changes to '.clientrc files contained in the workspace
      fileEvents: workspace.createFileSystemWatcher("**/.clientrc")
    }
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    "flux lsp server",
    "Flux Language Server",
    serverOptions,
    clientOptions
  );

  // Start the client. This will also launch the server
  client.start();
  console.log("client started");
}

// this method is called when your extension is deactivated
export function deactivate(): Thenable<void> | undefined {
  console.log("deactived plugin");
  if (!client) {
    return undefined;
  }
  return client.stop();
}
