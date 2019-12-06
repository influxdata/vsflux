import { workspace, ExtensionContext, window } from "vscode";

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  DidOpenTextDocumentNotification,
  DidSaveTextDocumentNotification,
  TransportKind
} from "vscode-languageclient";

export class Client {
  private languageClient: LanguageClient;
  private context: ExtensionContext;

  // constructor
  constructor(logFilePath: string, context: ExtensionContext) {
    this.context = context;
    let runArgs = ["--disable-folding", "--ipc"];
    let debugArgs = [...runArgs, "-l", logFilePath];
    let dir = "dist/out";
    let debugDir = "node_modules/@influxdata/flux-lsp-cli/out";

    let serverOptions: ServerOptions = {
      run: {
        module: this.context.asAbsolutePath(`${dir}/bundle.js`),
        transport: TransportKind.ipc,
        options: {
          cwd: this.context.asAbsolutePath(dir)
        },
        args: runArgs
      },
      debug: {
        module: this.context.asAbsolutePath(`${debugDir}/bundle.js`),
        transport: TransportKind.ipc,
        options: {
          cwd: this.context.asAbsolutePath(debugDir)
        },
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

  start(): void {
    this.actOnOpen(this.context);
    this.actOnSave(this.context);
    this.languageClient.start();
  }

  stop(): Thenable<void> | undefined {
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
