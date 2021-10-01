import { workspace, ExtensionContext, TextDocument } from 'vscode'
import through from 'through2'

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

import { Server } from '@influxdata/flux-lsp-node'
import { Transform } from 'stream'

const isFlux = (document : TextDocument) : boolean => {
    return document.languageId === 'flux'
}

function createTransform() : Transform {
    let count = 0
    let data = ''

    // NOTE: LSP server expects the content header and message as one message
    const transform = through(function(message, _encoding, done) {
        const line = message.toString()
        count += 1
        data += line

        function reset() : void {
            count = 0
            data = ''
        }

        if (count % 2 === 0) {
            try {
                this.push(data)
            } catch (e) {
                console.error(e)
            }
            reset()
        }

        done()
    })

    return transform
}

async function getBuckets() : Promise<string[]> {
    // XXX: rockstar (27 Aug 2021) - These functions were disabled
    // on the lsp side, and contained fragile, broken code. They
    // are intentionally left here as markers.
    console.debug('getBuckets')
    return []
}

async function getMeasurements(_bucket : string) : Promise<string[]> {
    // XXX: rockstar (27 Aug 2021) - These functions were disabled
    // on the lsp side, and contained fragile, broken code. They
    // are intentionally left here as markers.
    console.debug('getMeasurements')
    return []
}

async function getTagKeys(_bucket : string) : Promise<string[]> {
    // XXX: rockstar (27 Aug 2021) - These functions were disabled
    // on the lsp side, and contained fragile, broken code. They
    // are intentionally left here as markers.
    console.debug('getTagKeys')
    return []
}

async function getTagValues(_bucket : string, _field : string) : Promise<string[]> {
    // XXX: rockstar (27 Aug 2021) - These functions were disabled
    // on the lsp side, and contained fragile, broken code. They
    // are intentionally left here as markers.
    console.debug('getTagKeys')
    return []
}

function createStream() : Transform {
    const server = new Server(true, false)

    server.register_buckets_callback(getBuckets)
    server.register_measurements_callback(getMeasurements)
    server.register_tag_keys_callback(getTagKeys)
    server.register_tag_values_callback(getTagValues)

    return through(async function(data, _enc, cb) {
        const input = data.toString()

        console.debug(`>\n${input}\n`)

        try {
            const response = await server.process(input)
            const msg = response.get_message()

            if (msg) {
                console.debug(`<\n${msg}\n`)
                this.push(msg)
            }

            const err = response.get_error()
            if (err) {
                console.error(`LSP Error: ${err}`)
            }

            cb()
        } catch (e) {
            cb(e)
        }
    })
}

const createStreamInfo : (
    context : ExtensionContext
) => () => Promise<StreamInfo> = (_context) => {
    return function() : Promise<StreamInfo> {
        const stream = createStream()

        const writer = createTransform()
        writer.pipe(stream)

        return new Promise((resolve, _reject) => {
            resolve({
                writer,
                reader: stream
            })
        })
    }
}

export class Client {
    private languageClient : LanguageClient
    private context : ExtensionContext

    // constructor
    constructor(context : ExtensionContext) {
        this.context = context

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

        // Create the language client and start the client.
        this.languageClient = new LanguageClient(
            'flux lsp server',
            'flux language',
            createStreamInfo(context),
            clientOptions
        )

        this.context.subscriptions.push(
            workspace.onDidSaveTextDocument(this.onSave.bind(this))
        )

        context.subscriptions.push(
            workspace.onDidOpenTextDocument(this.onOpen.bind(this))
        )
    }

    start() : void {
        this.languageClient.start()
    }

    async stop() : Promise<void> {
        await this.languageClient.stop()
    }

    private onOpen(document : TextDocument) : void {
        if (!isFlux(document)) {
            return
        }

        const { languageId, version } = document

        this.languageClient.sendNotification(
            DidOpenTextDocumentNotification.type,
            {
                textDocument: {
                    languageId,
                    version,
                    uri: document.uri.toString(),
                    text: document.getText()
                }
            }
        )
    }

    private onSave = (document : TextDocument) : void => {
        if (!isFlux(document)) {
            return
        }

        const { version, uri } = document
        const textDocument = { uri: uri.toString(), version }

        this.languageClient.sendNotification(
            DidSaveTextDocumentNotification.type,
            { textDocument }
        )
    }
}
