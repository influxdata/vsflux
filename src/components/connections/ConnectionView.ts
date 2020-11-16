import { ExtensionContext, window, ViewColumn, Uri } from 'vscode'
import * as path from 'path'
import { View } from '../View'
import {
	InfluxDBTreeDataProvider,
	InfluxDBConnection,
	InfluxConnectionVersion,
	emptyInfluxDBConnection
} from './Connection'

import { defaultV1URL, defaultV2URLList } from '../../util'
import * as Mustache from 'mustache'

export class ConnectionView extends View {
	public constructor(context : ExtensionContext) {
		super(context, 'templates/editConn.html')
	}

	public async edit(
		conn : InfluxDBConnection
	) {
		return this.show('Edit Connection', conn)
	}

	public async create() {
		return this.show('New Connection')
	}

	private async show(
		title : string,
		conn : InfluxDBConnection = emptyInfluxDBConnection
	) {
		const panel = window.createWebviewPanel(
			'InfluxDB',
			title,
			ViewColumn.Active,
			{
				enableScripts: true,
				enableCommandUris: true,
				localResourceRoots: [
					Uri.file(path.join(this.context.extensionPath, 'templates'))
				]
			}
		)

		panel.webview.html = await this.html(conn, {
			cssPath: this.cssPath,
			jsPath: this.jsPath,
			title
		})

		await this.tree.setMessageHandler(panel)
	}

	private get cssPath() {
		return Uri.file(
			path.join(this.context.extensionPath, 'templates', 'form.css')
		).with({ scheme: 'vscode-resource' })
	}

	private get jsPath() {
		return Uri.file(
			path.join(this.context.extensionPath, 'templates', 'editConn.js')
		).with({ scheme: 'vscode-resource' })
	}

	private get tree() {
		return InfluxDBTreeDataProvider.instance
	}

	private async html(
		conn : InfluxDBConnection,
		params : { cssPath : Uri; jsPath : Uri; title : string }
	) : Promise<string> {
		return Mustache.render(this.template, {
			...conn,
			...params,
			isV1: conn.version === InfluxConnectionVersion.V1,
			defaultHostV1: defaultV1URL(),
			defaultHostLists: defaultV2URLList()
		})
	}
}
