import { INode } from './INode'
import { Queries } from '../Query'
import {
    TreeItem,
    TreeItemCollapsibleState
} from 'vscode'
import { InfluxDBConnection } from './Connection'
import { MeasurementNode } from './MeasurementNode'

import { logger } from '../../util'

export class BucketNode implements INode {
    constructor(
        private readonly bucket : string,
        private readonly conn : InfluxDBConnection
    ) { }

    public getTreeItem() : TreeItem {
        return {
            label: this.bucket,
            contextValue: this.bucket,
            collapsibleState: TreeItemCollapsibleState.Collapsed
        }
    }

    public async getChildren() : Promise<INode[]> {
        try {
            const msg = `Getting measurements for bucket: ${this.bucket}`
            logger.log(`${msg}`)

            const results = await Queries.measurements(this.conn, this.bucket)
            return (results?.rows || []).map((row) => {
                return new MeasurementNode(this.bucket, row[1], this.conn)
            })
        } catch (e) {
            logger.log(e)
            return []
        }
    }
}
