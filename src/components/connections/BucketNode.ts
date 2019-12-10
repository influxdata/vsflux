import { INode } from "./INode";
import { Engine as QueryEngine } from "../Query";
import {
  ExtensionContext,
  TreeItem,
  TreeItemCollapsibleState,
  OutputChannel
} from "vscode";
import { InfluxDBConnection } from "./Connection";
import { NewStringNode } from "./StringNode";

export function NewBucketNode(
  bucket: string,
  outputChannel: OutputChannel,
  conn: InfluxDBConnection
): BucketNode {
  return new BucketNode(bucket, outputChannel, conn);
}

export class BucketNode implements INode {
  constructor(
    private readonly bucket: string,
    private readonly outputChannel: OutputChannel,
    private readonly conn: InfluxDBConnection
  ) {}

  public getTreeItem(_: ExtensionContext): TreeItem {
    return {
      label: this.bucket,
      contextValue: this.bucket,
      collapsibleState: TreeItemCollapsibleState.Collapsed
    };
  }

  // get all the measurements
  public async getChildren(): Promise<INode[]> {
    let queryEngine: QueryEngine = new QueryEngine(this.outputChannel);
    return queryEngine.GetTreeChildren(
      this.conn,
      'import "influxdata/influxdb/v1"\nv1.tagKeys(bucket:"buck1")',
      "Getting tag keys for bucket: " + this.bucket,
      NewStringNode
    );
  }
}
