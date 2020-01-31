import { INode } from "./INode";
import { Engine as QueryEngine } from "../Query";
import { InfluxDBConnection, InfluxDBTreeDataProvider } from "./Connection";
import {
  ExtensionContext,
  TreeItem,
  TreeItemCollapsibleState,
  OutputChannel
} from "vscode";
import { NewBucketNode } from "./BucketNode";
import { Status } from "./Status";
import { EditConnectionView } from "./EditConnectionView";

export const InfluxDBConectionsKey = "influxdb.connections";

export class ConnectionNode implements INode {
  constructor(
    private readonly id: string,
    private readonly name: string,
    private readonly hostNport: string,
    private readonly token: string,
    private readonly org: string,
    private readonly outputChannel: OutputChannel
  ) {}

  public toConnection(): InfluxDBConnection {
    return {
      id: this.id,
      name: this.name,
      hostNport: this.hostNport,
      token: this.token,
      org: this.org
    };
  }

  public getTreeItem(context: ExtensionContext): TreeItem {
    return {
      label: this.name,
      collapsibleState: TreeItemCollapsibleState.Collapsed,
      command: {
        title: "switchConn",
        command: "influxdb.switchConn",
        arguments: [this.toConnection()]
      },
      contextValue: "connection",
      iconPath: context.asAbsolutePath("resources/server.png")
    };
  }

  // get all buckets
  public async getChildren(): Promise<INode[]> {
    let queryEngine: QueryEngine = new QueryEngine(this.outputChannel);
    return queryEngine.GetTreeChildren(
      this.toConnection(),
      "buckets()",
      "Fetching buckets",
      NewBucketNode
    );
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
      await editConnView.show(
        this.hostNport,
        false,
        influxDBTreeDataProvider,
        this.toConnection()
      );
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
      if (Status.Current !== undefined && Status.Current.id === this.id) {
        Status.Current = undefined;
      }
      delete connections[this.id];
    }

    await context.globalState.update(InfluxDBConectionsKey, connections);

    influxDBTreeDataProvider.refresh();
  }
}
