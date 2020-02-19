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

export function NewMeasurementNode(
  measurement: string,
  outputChannel: OutputChannel,
  conn: InfluxDBConnection,
  bucket?: string
): MeasurementNode {
  return new MeasurementNode(
    bucket as string,
    measurement,
    outputChannel,
    conn
  );
}

export class MeasurementNode implements INode {
  constructor(
    private readonly bucket: string,
    private readonly measurement: string,
    private readonly outputChannel: OutputChannel,
    private readonly conn: InfluxDBConnection
  ) {}

  public getTreeItem(_: ExtensionContext): TreeItem {
    return {
      label: this.measurement,
      contextValue: this.measurement,
      collapsibleState: TreeItemCollapsibleState.Collapsed
    };
  }

  // get all the measurements
  public async getChildren(): Promise<INode[]> {
    let queryEngine: QueryEngine = new QueryEngine(this.outputChannel);
    let query = `import "influxdata/influxdb/v1"
    v1.measurementTagKeys(bucket:"${this.bucket}", measurement: "${this.measurement}")`;
    if (this.conn.version === InfluxConnectionVersion.V1) {
      query = `show tag keys from ${this.measurement}`;
    }
    return queryEngine.GetTreeChildren(
      this.conn,
      query,
      `Getting tag keys for bucket: ${this.bucket}, measurement: ${this.measurement}: `,
      NewStringNode,
      this.bucket
    );
  }
}
