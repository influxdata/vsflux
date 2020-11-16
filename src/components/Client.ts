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
} from 'vscode-languageclient'

import { Server } from '@influxdata/flux-lsp-node'
import { Status } from './connections/Status'
import { Queries } from '../components/Query'

const isFlux = (document : TextDocument) : boolean => {
	return document.languageId === 'flux'
}

const createTransform = () => {
	let count = 0
	let data = ''

	// NOTE: LSP server expects the content header and message as one message
	const transform = through(function(message, _encoding, done) {
		const line = message.toString()
		count += 1
		data += line

		function reset() {
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

async function getBuckets() {
	if (Status.Current) {
		const buckets = await Queries.buckets(Status.Current)
		return (buckets?.rows || []).map(row => row[0])
	}

	return []
}

async function getMeasurements(bucket : string) {
	if (Status.Current) {
		const measurements = await Queries.measurements(Status.Current, bucket)
		return (measurements?.rows || []).map(row => row[0])
	}

	return []
}

async function getTagKeys(bucket : string) {
	if (Status.Current) {
		const tagKeys = await Queries.bucketTagKeys(Status.Current, bucket)
		return (tagKeys?.rows || []).map(row => row[0]?.trim())
	}
	return []
}

async function getTagValues(bucket : string, field : string) {
	if (Status.Current) {
		const tagValues = await Queries.tagValues(Status.Current, bucket, field)
		return (tagValues?.rows || []).map(row => row[0]?.trim())
	}

	return []
}

const createStream = () => {
	const server = new Server(true, false)

	server.register_buckets_callback(getBuckets)
	server.register_measurements_callback(getMeasurements)
	server.register_tag_keys_callback(getTagKeys)
	server.register_tag_values_callback(getTagValues)

	return through(async function(data, _enc, cb) {
		const input = data.toString()

		console.debug(`Request:\n ${input}\n`)

		try {
			const response = await server.process(input)
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

const createStreamInfo : (
	context : ExtensionContext
) => () => Promise<StreamInfo> = (context) => {
	return function() {
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
				error: () => ErrorAction.Continue,
				closed: () => CloseAction.Restart
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
			workspace.onDidSaveTextDocument(this.onSave)
		)

		context.subscriptions.push(
			workspace.onDidOpenTextDocument(this.onOpen)
		)
	}

	start() {
		this.languageClient.start()
	}

	async stop() {
		this.languageClient.stop()
	}

	private onOpen = (document : TextDocument) => {
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
