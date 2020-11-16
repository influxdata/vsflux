import { INode } from './INode'
import { Queries } from '../Query'
import {
	InfluxDBConnection,
	InfluxDBTreeDataProvider
} from './Connection'
import {
	ExtensionContext,
	TreeItem,
	TreeItemCollapsibleState
} from 'vscode'
import { NewBucketNode } from './BucketNode'
import { Status } from './Status'
import { ConnectionView } from './ConnectionView'
import { logger } from '../../util'

export const InfluxDBConnectionsKey = 'influxdb.connections'

export class ConnectionNode implements INode {
	constructor(
		public connection : InfluxDBConnection,
		private context : ExtensionContext,
		public label : string
	) { }

	public get status() {
		return this.connection.isActive ? '' : '-gray'
	}

	public get iconPath() {
		return this.context.asAbsolutePath(`resources/influx-logo${this.status}.svg`)
	}

	public getTreeItem() : TreeItem {
		return {
			label: this.connection.name,
			collapsibleState: TreeItemCollapsibleState.Collapsed,
			command: {
				title: 'switchConn',
				command: 'influxdb.switchConn',
				arguments: [this]
			},
			contextValue: 'connection',
			iconPath: this.iconPath
		}
	}

	// get all buckets
	public async getChildren() : Promise<INode[]> {
		try {
			logger.log('Fetching buckets')

			const results = await Queries.buckets(this.connection)

			return (results?.rows || []).map((row) => {
				return NewBucketNode(row[0], this.connection)
			})
		} catch (e) {
			logger.log(e)
			return []
		}
	}

	public get tree() : InfluxDBTreeDataProvider {
		return InfluxDBTreeDataProvider.instance
	}

	public async edit(
	) {
		const view = new ConnectionView(this.context)
		await view.edit(this.connection)
	}

	public async remove(
	) {
		const connections = this.context.globalState.get<{
			[key : string] : InfluxDBConnection;
		}>(InfluxDBConnectionsKey) || {}

		delete connections[this.connection.id]

		if (Status.Current?.id === this.connection.id) {
			Status.Current = Object.values(connections)[0]
		}

		await this.context.globalState.update(InfluxDBConnectionsKey, connections)

		this.tree.refresh()
	}
}
