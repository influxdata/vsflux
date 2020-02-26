import { INode } from './INode'
import { Queries } from '../Query'
import {
  ExtensionContext,
  TreeItem,
  TreeItemCollapsibleState,
  OutputChannel
} from 'vscode'
import { InfluxDBConnection } from './Connection'
import { MeasurementNode } from './MeasurementNode'

import { now, outputChannel } from '../../util'

export function NewBucketNode (
  bucket: string,
  conn: InfluxDBConnection
): BucketNode {
  return new BucketNode(bucket, conn)
}

export class BucketNode implements INode {
  constructor (
    private readonly bucket: string,
    private readonly conn: InfluxDBConnection
  ) {}

  public getTreeItem (_: ExtensionContext): TreeItem {
    return {
      label: this.bucket,
      contextValue: this.bucket,
      collapsibleState: TreeItemCollapsibleState.Collapsed
    }
  }

  // get all the measurements
  public async getChildren (): Promise<INode[]> {
    try {
      const msg = `Getting measurements for bucket: ${this.bucket}`
      outputChannel.show()
      outputChannel.appendLine(`${now()} - ${msg}`)

      const results = await Queries.measurements(this.conn, this.bucket)
      return (results?.rows || []).map((row) => {
        return new MeasurementNode(this.bucket, row[0], this.conn)
      })
    } catch (e) {
      outputChannel.appendLine(`${now()} - Error: ${e}`)
      return []
    }
  }
}
