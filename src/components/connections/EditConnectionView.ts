import { ExtensionContext, window, ViewColumn, Uri } from "vscode";
import mustache = require("mustache");
import * as path from "path";
import { View } from "../View";
import {
  InfluxDBTreeDataProvider,
  InfluxDBConnection,
  InfluxConnectionVersion,
  emptyInfluxDBConnection
} from "./Connection";

export class EditConnectionView extends View {
  public constructor(context: ExtensionContext) {
    super(context, "templates/editConn.html");
  }

  public async showEdit(
    tree: InfluxDBTreeDataProvider,
    conn: InfluxDBConnection
  ) {
    this.show(conn.hostNport, "", "Edit Connection", tree, conn);
  }

  public async showNew(
    defaultHost: string,
    defaultHostV1: string,
    tree: InfluxDBTreeDataProvider
  ) {
    this.show(defaultHost, defaultHostV1, "Add Connection", tree);
  }

  private async show(
    defaultHost: string,
    defaultHostV1: string,
    title: string,
    tree: InfluxDBTreeDataProvider,
    conn: InfluxDBConnection = emptyInfluxDBConnection()
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
      isV1: conn.version === InfluxConnectionVersion.V1,
      title: title,
      connID: conn.id,
      connName: conn.name,
      defaultHostV1: defaultHostV1,
      defaultHost: defaultHost,
      connToken: conn.token,
      connOrg: conn.org
    });
    await InfluxDBTreeDataProvider.handleMessage(panel, tree);
  }
}
