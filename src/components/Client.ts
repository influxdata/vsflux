import { workspace, ExtensionContext, window } from "vscode";

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  DidOpenTextDocumentNotification,
  DidSaveTextDocumentNotification
} from "vscode-languageclient";

export class Client {
  private languageClient: LanguageClient;

  // constructor
  constructor(lspExe: string, logFilePath: string) {
    let cmd = lspExe;
    let debugArgs = ["--disable-folding", "-l", logFilePath];

    let serverOptions: ServerOptions = {
      run: {
        command: cmd,
        args: ["--disable-folding"]
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
    this.languageClient = new LanguageClient(
      "flux lsp server",
      "flux language",
      serverOptions,
      clientOptions
    );
  }

  start(context: ExtensionContext): void {
    this.actOnOpen(context);
    this.actOnSave(context);
    this.languageClient.start();

    console.log("flux lsp client started");
  }

  stop(): Thenable<void> | undefined {
    console.log("deactived flux plugin");
    if (!this.languageClient) {
      return undefined;
    }
    return this.languageClient.stop();
  }

  private actOnOpen(context: ExtensionContext): void {
    context.subscriptions.push(
      workspace.onDidOpenTextDocument(document => {
        if (
          document.languageId !== "flux" ||
          !document.fileName.endsWith(".flux")
        ) {
          return;
        }
        this.languageClient.sendNotification(
          DidOpenTextDocumentNotification.type,
          {
            textDocument: {
              uri: document.uri.toString(),
              languageId: document.languageId,
              text: document.getText(),
              version: document.version
            }
          }
        );
      })
    );
  }

  private actOnSave(context: ExtensionContext): void {
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
        this.languageClient.sendNotification(
          DidSaveTextDocumentNotification.type,
          {
            textDocument: {
              uri: document.uri.toString(),
              version: document.version
            }
          }
        );
      })
    );
  }
}
