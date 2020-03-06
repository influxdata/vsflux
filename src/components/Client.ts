import { workspace, ExtensionContext, window, TextDocument } from 'vscode'
import through from 'through2'

import {
  LanguageClient,
  LanguageClientOptions,
  DidOpenTextDocumentNotification,
  DidSaveTextDocumentNotification,
  StreamInfo
} from 'vscode-languageclient'

import CLI from '@influxdata/flux-lsp-cli'
import { Server } from '@influxdata/flux-lsp-node'
import { Status } from './connections/Status'
import { Queries } from '../components/Query'

const isFlux = (document: TextDocument): boolean => {
  return document.languageId === 'flux'
}

const createTransform = () => {
  let count = 0
  let data = ''

  // NOTE: LSP server expects the content header and message as one message
  const transform = through(function (message, _encoding, done) {
    const line = message.toString()
    count += 1
    data += line

    function reset () {
      count = 0
      data = ''
    }

    if (count % 2 === 0) {
      try {
        this.push(data)
      } catch (e) {
        console.log(e)
      }
      reset()
    }

    done()
  })

  return transform
}

async function getBuckets () {
  if (Status.Current) {
    const buckets = await Queries.buckets(Status.Current)
    return (buckets?.rows || []).map(row => row[0])
  }

  return []
}

const createStream = () => {
  const server = new Server(true)
  server.register_buckets_callback(getBuckets)

  return through(async function (data, _enc, cb) {
    const input = data.toString()

    console.debug(`Request:\n ${input}\n`)

    const response = await server.process(input)

    try {
      const msg = response.get_message()
      if (msg) {
        console.debug(`Response:\n ${msg}\n`)
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

const createStreamInfo: (
  context: ExtensionContext
) => () => Thenable<StreamInfo> = (context) => {
  return function () {
    const stream = createStream()

    const writer = createTransform()
    writer.pipe(stream)

    return new Promise((resolve, reject) => {
      resolve({
        writer,
        reader: stream
      })
    })
  }
}

export class Client {
  private languageClient: LanguageClient
  private context: ExtensionContext

  // constructor
  constructor (context: ExtensionContext) {
    this.context = context

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
      // Register the server for flux documents
      documentSelector: [{ scheme: 'file', language: 'flux' }],
      synchronize: {
        // Notify the server about file changes to '.clientrc files contained in the workspace
        fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
      }
    }

    // Create the language client and start the client.
    this.languageClient = new LanguageClient(
      'flux lsp server',
      'flux language',
      createStreamInfo(context),
      clientOptions
    )
  }

  start () {
    this.actOnOpen(this.context)
    this.actOnSave(this.context)
    this.languageClient.start()
  }

  async stop () {
    if (this.languageClient) {
      this.languageClient.stop()
    }
  }

  private actOnOpen (context: ExtensionContext) {
    context.subscriptions.push(
      workspace.onDidOpenTextDocument(document => {
        if (
          document.languageId !== 'flux' ||
          !document.fileName.endsWith('.flux')
        ) {
          return
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
        )
      })
    )
  }

  private actOnSave (context: ExtensionContext): void {
    context.subscriptions.push(
      workspace.onDidSaveTextDocument(document => {
        if (!isFlux(document)) {
          return
        }

        const { version, uri } = document
        const textDocument = { uri: uri.toString(), version }

        this.languageClient.sendNotification(
          DidSaveTextDocumentNotification.type,
          { textDocument }
        )
      })
    )
  }
}
