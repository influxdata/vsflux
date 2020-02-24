import fs, { write } from 'fs';
import { workspace, ExtensionContext, window } from "vscode";
import through from 'through2';

import {
  LanguageClient,
  LanguageClientOptions,
  DidOpenTextDocumentNotification,
  DidSaveTextDocumentNotification,
  StreamInfo
} from "vscode-languageclient";

import CLI from "@influxdata/flux-lsp-cli";
import { Status } from './connections/Status';
import { Queries } from '../components/Query';

const createTransform = () => {
  let count = 0;
  let data = "";

  // NOTE: LSP server expects the content header and message as one message
  const transform = through(function (message, _encoding, done) {
    const line = message.toString();
    count += 1;
    data += line;

    function reset() {
      count = 0;
      data = "";
    }

    if (count % 2 === 0) {
      try {
        this.push(data);
      } catch (e) {
        console.log(e);
      }
      reset();
    }

    done();
  });

  return transform;
};

async function getBuckets() {
  if (Status.Current) {
    const buckets = await Queries.buckets(Status.Current);
    return (buckets?.Rows || []).map((row) => row[0]);
  }

  return []
}

const createStreamInfo: (context: ExtensionContext, cli: CLI) => () => Thenable<StreamInfo> = (context, cli) => {
  return function () {
    const stream = cli.createStream();

    cli.registerBucketsCallback(getBuckets);

    const writer = createTransform();
    writer.pipe(stream);

    return new Promise((resolve, _reject) => {
      resolve({
        writer,
        reader: stream,
      });
    });
  };
};

export class Client {
  private languageClient: LanguageClient;
  private context: ExtensionContext;
  private cli: CLI

  // constructor
  constructor(logFilePath: string, context: ExtensionContext) {
    this.context = context;

    // Options to control the language client
    let clientOptions: LanguageClientOptions = {
      // Register the server for flux documents
      documentSelector: [{ scheme: "file", language: "flux" }],
      synchronize: {
        // Notify the server about file changes to '.clientrc files contained in the workspace
        fileEvents: workspace.createFileSystemWatcher("**/.clientrc")
      }
    };

    this.cli = new CLI({ "disable-folding": true });
    this.cli.on("log", console.debug);


    // Create the language client and start the client.
    this.languageClient = new LanguageClient(
      "flux lsp server",
      "flux language",
      createStreamInfo(context, this.cli),
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
