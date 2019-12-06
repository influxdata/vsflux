import { ExtensionContext, window, ViewColumn } from "vscode";
import fs = require("fs");
import mustache = require("mustache");

export interface TableResult {
  Head: Array<string>;
  Rows: Array<Array<string>>;
}

export class TableView {
  private template: string;
  public constructor(context: ExtensionContext) {
    this.template = String(
      fs.readFileSync(context.asAbsolutePath("templates/table.mst"))
    );
  }
  public show(result: TableResult, title: string) {
    const panel = window.createWebviewPanel("InfluxDB", title, ViewColumn.Two, {
      retainContextWhenHidden: true
    });

    panel.webview.html = mustache.to_html(this.template, result);
  }
}
