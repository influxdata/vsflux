import { View } from './View'
import { ExtensionContext, window, ViewColumn } from 'vscode'

import mustache = require('mustache');

type Rows = string[][]

export interface TableResult {
  head: string[];
  rows: Rows;
}

export class TableView extends View {
  public constructor (context: ExtensionContext) {
    super(context, 'templates/table.html')
  }

  public async show (result: TableResult, title: string) {
    const panel = window.createWebviewPanel('InfluxDB', title, ViewColumn.Two, {
      retainContextWhenHidden: true
    })

    const template = await this.getTemplate()
    panel.webview.html = mustache.to_html(template, result)
  }
}
