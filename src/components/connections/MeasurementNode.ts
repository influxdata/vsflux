import { INode } from './INode'
import { Queries } from '../Query'
import {
	TreeItem,
	TreeItemCollapsibleState
} from 'vscode'
import { InfluxDBConnection } from './Connection'
import { StringNode } from './StringNode'
import { logger } from '../../util'

export class MeasurementNode implements INode {
	constructor(
		private readonly bucket : string,
		private readonly measurement : string,
		private readonly conn : InfluxDBConnection
	) { }

	public getTreeItem() : TreeItem {
		return {
			label: this.measurement,
			contextValue: this.measurement,
			collapsibleState: TreeItemCollapsibleState.Collapsed
		}
	}

	// get all the measurements
	public async getChildren() : Promise<INode[]> {
		try {
			const msg =
				`Getting tag keys for bucket: ${this.bucket}, measurement: ${this.measurement}: `

			logger.log(msg)

			const results = await Queries.tagKeys(this.conn, this.bucket, this.measurement)

			return (results?.rows || []).map((row) => {
				return new StringNode(row[0])
			})
		} catch (e) {
			logger.log(e)
			return []
		}
	}
}
