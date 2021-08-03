import * as path from 'path'
import * as Mustache from 'mustache'
import { ExtensionContext, window, ViewColumn, Uri } from 'vscode'

import { View } from './View'
import { TableResult } from './util/query'

export class TableView extends View {
    public constructor(context : ExtensionContext) {
        super(context, 'templates/table.html')
    }

    private get cssPath() {
        return Uri.file(
            path.join(this.context.extensionPath, 'templates', 'table.css')
        )
    }

    public async show(results : TableResult[], title : string) {
        const panel = window.createWebviewPanel('InfluxDB', title, ViewColumn.Two, {
            retainContextWhenHidden: true
        })

        panel.webview.html = Mustache.render(this.template, {
            cssPath: panel.webview.asWebviewUri(this.cssPath),
            results: results
        })
    }
}
