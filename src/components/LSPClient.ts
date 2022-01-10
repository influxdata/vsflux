import { Transform } from 'stream'

import { Server } from '@influxdata/flux-lsp-node'
import * as vscode from 'vscode'
import {
    LanguageClient,
    LanguageClientOptions,
    DidOpenTextDocumentNotification,
    DidSaveTextDocumentNotification,
    StreamInfo,
    ErrorAction,
    CloseAction,
    RevealOutputChannelOn
} from 'vscode-languageclient/node'

// Handle writes to the LSP server
//
// The data comes across as a header (with terminating \r\n\r\n) or
// the body. This transform joins those messages into a single message
// to send down the pipe.
class WriteTransform extends Transform {
    private count : number
    private data : string

    constructor(options : Record<string, unknown>) {
        super(options)
        this.count = 0
        this.data = ''
    }

    _transform(chunk : string, _encoding : string, callback : (error ?: Error) => void) {
        this.count += 1
        this.data += chunk.toString()
        if (this.count % 2 === 0) {
            try {
                this.push(this.data)
            } catch (e) {
                console.error(e)
            } finally {
                // Reset the state
                this.count = 0
                this.data = ''
            }
        }
        callback()
    }
}

class ReadTransform extends Transform {
    private server : Server

    constructor(options : Record<string, unknown>) {
        super(options)

        this.server = new Server(true, false)
    }

    _transform(chunk : string, _encoding : string, callback : (error ?: Error) => void) {
        const input = chunk.toString()
        console.debug(`>\n${input}\n`)

        this.server.process(input)
            .then((response) => {
                const msg = response.get_message()
                if (msg) {
                    console.debug(`<\n${msg}\n`)
                    this.push(msg)
                }

                const err = response.get_error()
                if (err) {
                    console.error(`LSP Error: ${err}`)
                }
                callback()
            })
            .catch((err) => {
                callback(err)
            })
    }
}

export class LSPClient {
    private languageClient : LanguageClient

    // constructor
    constructor(context : vscode.ExtensionContext) {
        // Options to control the language client
        const clientOptions : LanguageClientOptions = {
            // Register the server for flux documents
            documentSelector: [{ scheme: 'file', language: 'flux' }],
            errorHandler: {
                error: () : ErrorAction => ErrorAction.Continue,
                closed: () : CloseAction => CloseAction.Restart
            },
            revealOutputChannelOn: RevealOutputChannelOn.Never
        }

        const streamInfo = () : Promise<StreamInfo> => {
            const reader = new ReadTransform({})
            const writer = new WriteTransform({})
            writer.pipe(reader)

            return new Promise((resolve, _reject) => {
                resolve({
                    writer,
                    reader
                })
            })
        }

        // Create the language client and start the client.
        this.languageClient = new LanguageClient(
            'flux lsp server',
            'flux language',
            streamInfo,
            clientOptions
        )

        context.subscriptions.push(
            vscode.workspace.onDidSaveTextDocument(this.onSave.bind(this))
        )
        context.subscriptions.push(
            vscode.workspace.onDidOpenTextDocument(this.onOpen.bind(this))
        )
    }

    start() : void {
        this.languageClient.start()
    }

    async stop() : Promise<void> {
        await this.languageClient.stop()
    }

    private onOpen(document : vscode.TextDocument) : void {
        if (document.languageId !== 'flux') { return }

        this.languageClient.sendNotification(
            DidOpenTextDocumentNotification.type,
            {
                textDocument: {
                    languageId: document.languageId,
                    version: document.version,
                    uri: document.uri.toString(),
                    text: document.getText()
                }
            }
        )
    }

    private onSave(document : vscode.TextDocument) : void {
        if (document.languageId !== 'flux') { return }

        this.languageClient.sendNotification(
            DidSaveTextDocumentNotification.type,
            {
                textDocument: {
                    uri: document.uri.toString()
                }
            }
        )
    }
}
