import { INode } from "./INode";
import { Engine as QueryEngine } from "../Query";
import {
  ExtensionContext,
  TreeItem,
  TreeItemCollapsibleState,
  OutputChannel
} from "vscode";
import { InfluxDBConnection, InfluxConnectionVersion } from "./Connection";
import { NewStringNode } from "./StringNode";
import { NewMeasurementNode } from "./MeasurementNode";

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
    let query = `import "influxdata/influxdb/v1"
    v1.measurements(bucket:"${this.bucket}")`;
    if (this.conn.version === InfluxConnectionVersion.V1) {
      query = "show measurements";
    }
    return queryEngine.GetTreeChildren(
      this.conn,
      query,
      "Getting measurements for bucket: " + this.bucket,
      NewMeasurementNode,
      this.bucket
    );
  }
}
