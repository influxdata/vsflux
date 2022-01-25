import { Transform } from 'stream'

import { Lsp, initLog } from '@influxdata/flux-lsp-node'
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

/* Handle writes and reads to the Lsp.
 *
 * This transform wraps the Lsp wasm interface in a node stream
 * that can be consumed by LanguageClient.
 *
 * Much of the complexity here is that we are stripping out Content-Length headers
 * on write and adding them back on in read. If the wasm interface gets a full LSP message,
 * it will crash, and if the LanguageClient gets a straight json message, it will also crash,
 * with all subsequent messages erroring with "the LanguageClient is not yet ready."
 */
class LspTransform extends Transform {
    private lsp : Lsp

    constructor() {
        super({})
        initLog()
        this.lsp = new Lsp()
        this.lsp.onMessage(this.onMessage.bind(this))
        this.lsp.run()
    }

    /* Handle incoming messages from the server. */
    private onMessage(message : string) : void {
        console.debug(`<< ${message}`)
        this.push(message)
    }

    /* Wrap `push` to append info headers that LanguageClient expects */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    push(chunk : any, encoding ?: BufferEncoding | undefined) : boolean {
        const data = chunk.toString()
        console.debug(`< ${data}`)
        return super.push(`Content-Length: ${data.length}\r\n\r\n${data}`, encoding)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _transform(chunk : Buffer | string | any, _encoding : string, callback : (error ?: Error) => void) {
        const data = chunk.toString()
        if (data.startsWith('Content-Length')) {
            callback()
        } else {
            console.debug(`> ${data}`)
            this.lsp.send(data).then((message) => {
                if (message !== undefined) {
                    this.push(message)
                }
                callback()
            }).catch((reason) => {
                console.error(reason)
                callback(reason)
            })
        }
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
            const transform = new LspTransform()

            return new Promise((resolve, _reject) => {
                resolve({
                    writer: transform,
                    reader: transform
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
