import "./View";
import { ExtensionContext, window, ViewColumn } from "vscode";
import mustache = require("mustache");
import { View } from "./View";

export interface TableResult {
  Head: Array<string>;
  Rows: Array<Array<string>>;
}

export class TableView extends View {
  public constructor(context: ExtensionContext) {
    super(context, "templates/table.html");
  }
  public show(result: TableResult, title: string) {
    const panel = window.createWebviewPanel("InfluxDB", title, ViewColumn.Two, {
      retainContextWhenHidden: true
    });

    panel.webview.html = mustache.to_html(this.template, result);
  }
}
