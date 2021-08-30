import * as path from 'path'
import * as Mustache from 'mustache'
import { ExtensionContext, window, ViewColumn, Uri } from 'vscode'
import { QueryResult } from '../models'

import { View } from './View'

// XXX: rockstar (27 Aug 2021) - This view currently renders the
// "result" field, which the web ui does not. Should it strip it out?
export class TableView extends View {
    public constructor(context : ExtensionContext) {
        super(context, 'templates/table.html')
    }

    private get cssPath() : Uri {
        return Uri.file(
            path.join(this.context.extensionPath, 'templates', 'table.css')
        )
    }

    public async show(results : QueryResult, title : string) : Promise<void> {
        const panel = window.createWebviewPanel('InfluxDB', title, ViewColumn.Two, {
            retainContextWhenHidden: true
        })

        panel.webview.html = Mustache.render(this.template, {
            cssPath: panel.webview.asWebviewUri(this.cssPath),
            results: results
        })
    }
}
