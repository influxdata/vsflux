import { View } from './View'
import * as path from 'path'
import { ExtensionContext, window, ViewColumn, Uri } from 'vscode'

import * as Mustache from 'mustache'

type Rows = string[][];

export interface TableResult {
  head: string[];
  rows: Rows;
}

export var EmptyTableResult = { head: [], rows: [] }

export class TableView extends View {
  public constructor (context: ExtensionContext) {
    super(context, 'templates/table.html')
  }

  public async show (results: TableResult[], title: string) {
    const panel = window.createWebviewPanel('InfluxDB', title, ViewColumn.Two, {
      retainContextWhenHidden: true
    })

    const template = await this.getTemplate()
    panel.webview.html = Mustache.render(template, {
      cssPath: panel.webview.asWebviewUri(
        Uri.file(
          path.join(this.context.extensionPath, 'templates', 'table.css')
        )
      ),
      results: results
    })
  }
}
