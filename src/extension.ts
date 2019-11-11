// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as path from "path";
import { workspace, ExtensionContext, window } from "vscode";

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions
} from "vscode-languageclient";

let client: LanguageClient;

import { DidSaveTextDocumentNotification } from "vscode-languageserver-protocol";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
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

  addExecutingActionOnSave(context, client);
  console.log("flux lsp client started");
}

// this method is called when your extension is deactivated
export function deactivate(): Thenable<void> | undefined {
  console.log("deactived plugin");
  if (!client) {
    return undefined;
  }
  return client.stop();
}

function addExecutingActionOnSave(
  context: ExtensionContext,
  client: LanguageClient
): void {
  context.subscriptions.push(
    workspace.onDidSaveTextDocument(document => {
      if (!window.activeTextEditor) {
        return;
      }
      const activeDocument = window.activeTextEditor.document;
      if (document !== activeDocument) {
        return;
      }
      if (
        document.languageId !== "flux" ||
        !document.fileName.endsWith(".flux")
      ) {
        return;
      }
      client.sendNotification(DidSaveTextDocumentNotification.type, {
        textDocument: {
          uri: document.uri.toString(),
          version: document.version
        }
      });
    })
  );
}
