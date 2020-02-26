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

import { defaultV1URL, defaultV2URLList } from "../../util";

export class EditConnectionView extends View {
  public constructor(context: ExtensionContext) {
    super(context, "templates/editConn.html");
  }

  public async showEdit(
    tree: InfluxDBTreeDataProvider,
    conn: InfluxDBConnection
  ) {
    this.show("Edit Connection", tree, conn);
  }

  public async showNew(tree: InfluxDBTreeDataProvider) {
    this.show("Add Connection", tree, emptyInfluxDBConnection);
  }

  private async show(
    title: string,
    tree: InfluxDBTreeDataProvider,
    conn: InfluxDBConnection
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

    panel.webview.html = await this.templateHTML(conn, {
      cssPath: panel.webview.asWebviewUri(
        Uri.file(path.join(this.context.extensionPath, "templates", "form.css"))
      ),
      jsPath: panel.webview.asWebviewUri(
        Uri.file(
          path.join(this.context.extensionPath, "templates", "editConn.js")
        )
      ),
      title
    });

    await InfluxDBTreeDataProvider.setMessageHandler(panel, tree);
  }

  private async templateHTML(
    conn: InfluxDBConnection,
    params: { cssPath: Uri; jsPath: Uri; title: string }
  ): Promise<string> {
    const template = await this.getTemplate();
    return mustache.to_html(template, {
      ...conn,
      ...params,
      isV1: conn.version === InfluxConnectionVersion.V1,
      defaultHostV1: defaultV1URL(),
      defaultHost: conn.hostNport,
      defaultHostLists: defaultV2URLList()
    });
  }
}
