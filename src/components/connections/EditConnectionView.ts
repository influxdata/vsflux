import { ExtensionContext, window, ViewColumn, Uri } from "vscode";
import mustache = require("mustache");
import * as path from "path";
import { View } from "../View";
import { InfluxDBTreeDataProvider, InfluxDBConnection } from "./Connection";

export class EditConnectionView extends View {
  public constructor(context: ExtensionContext) {
    super(context, "templates/editConn.mst");
  }

  public async showEdit(
    tree: InfluxDBTreeDataProvider,
    conn: InfluxDBConnection
  ) {
    this.show(conn.hostNport, "Edit Connection", tree, conn);
  }

  public async showNew(
    defaultHostNPort: string,
    tree: InfluxDBTreeDataProvider
  ) {
    this.show(defaultHostNPort, "Add Connection", tree, undefined);
  }

  private async show(
    defaultHostNPort: string,
    title: string,
    tree: InfluxDBTreeDataProvider,
    conn: InfluxDBConnection | undefined
  ) {
    const panel = window.createWebviewPanel(
      "InfluxDB",
      title,
      ViewColumn.Active,
      {
        enableScripts: true,
        enableCommandUris: true,
        localResourceRoots: [
          Uri.file(path.join(this.context.extensionPath, "templates"))
        ]
      }
    );

    panel.webview.html = mustache.to_html(this.template, {
      cssPath: panel.webview.asWebviewUri(
        Uri.file(path.join(this.context.extensionPath, "templates", "form.css"))
      ),
      jsPath: panel.webview.asWebviewUri(
        Uri.file(
          path.join(this.context.extensionPath, "templates", "editConn.js")
        )
      ),
      title: title,
      connID: conn !== undefined ? conn.id : "",
      connName: conn !== undefined ? conn.name : "",
      defaultHostNPort: defaultHostNPort,
      connToken: conn !== undefined ? conn.token : "",
      connOrg: conn !== undefined ? conn.org : ""
    });
    await InfluxDBTreeDataProvider.handleMessage(panel, tree);
  }
}
