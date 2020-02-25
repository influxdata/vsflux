import { INode } from "./INode";
import { Queries } from "../Query";
import {
  InfluxDBConnection,
  InfluxDBTreeDataProvider,
} from "./Connection";
import {
  ExtensionContext,
  TreeItem,
  TreeItemCollapsibleState,
  OutputChannel
} from "vscode";
import { NewBucketNode } from "./BucketNode";
import { Status } from "./Status";
import { EditConnectionView } from "./EditConnectionView";
import { now, outputChannel } from "../../util";

export const InfluxDBConectionsKey = "influxdb.connections";

export class ConnectionNode implements INode {
  constructor(
    public connection: InfluxDBConnection,
  ) {}

  public getTreeItem(context: ExtensionContext): TreeItem {
    let status = this.connection.isActive ? "" : "-gray";
    return {
      label: this.connection.name,
      collapsibleState: TreeItemCollapsibleState.Collapsed,
      command: {
        title: "switchConn",
        command: "influxdb.switchConn",
        arguments: [this]
      },
      contextValue: "connection",
      iconPath: context.asAbsolutePath(`resources/influx-logo${status}.svg`)
    };
  }

  // get all buckets
  public async getChildren(): Promise<INode[]> {
    try {
      const msg = "Fetching buckets";
      outputChannel.show();
      outputChannel.appendLine(`${now()} - ${msg}`);

      const results = await Queries.buckets(this.connection);

      return (results?.rows || []).map((row) => {
        return NewBucketNode(row[0], this.connection);
      });
    } catch (e) {
      outputChannel.appendLine(`${now()} - Error: ${e}`);
      return [];
    }
  }

  public async editConnection(
    context: ExtensionContext,
    influxDBTreeDataProvider: InfluxDBTreeDataProvider
  ) {
    const connections = context.globalState.get<{
      [key: string]: InfluxDBConnection;
    }>(InfluxDBConectionsKey);
    if (connections !== undefined) {
      let editConnView = new EditConnectionView(context);
      await editConnView.showEdit(influxDBTreeDataProvider, this.connection);
      return;
    }
  }

  public async deleteConnection(
    context: ExtensionContext,
    influxDBTreeDataProvider: InfluxDBTreeDataProvider
  ) {
    const connections = context.globalState.get<{
      [key: string]: InfluxDBConnection;
    }>(InfluxDBConectionsKey);

    if (connections) {
      if (Status.Current !== undefined && Status.Current.id === this.connection.id) {
        Status.Current = undefined;
      }
      delete connections[this.connection.id];
    }

    await context.globalState.update(InfluxDBConectionsKey, connections);

    influxDBTreeDataProvider.refresh();
  }
}
