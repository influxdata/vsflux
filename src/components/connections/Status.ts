import { InfluxDBConnection } from './Connection'
import { StatusBarItem, window, StatusBarAlignment } from 'vscode'
import { CancelTokenSource } from 'axios'

class ConnectionStatusBar {
	public item : StatusBarItem;

	constructor() {
		this.item = window.createStatusBarItem(StatusBarAlignment.Left)
	}

	setIdle(connection ?: InfluxDBConnection) {
		this.item.text = ''
		if (connection) {
			this.item.text = `$(server) ${connection.name}`
		}
		this.item.command = undefined
		this.item.show()
	}

	setQueryRunning() {
		this.item.text = '$(chrome-close) cancel query'
		this.item.command = 'influxdb.cancelQuery'
		this.item.show()
	}
}

export class Status {
	private static current ?: InfluxDBConnection;
	private static connectionStatusBar : ConnectionStatusBar = new ConnectionStatusBar()

	static get Current() {
		return Status.current
	}

	static set Current(conn : InfluxDBConnection | undefined) {
		this.current = conn
		this.connectionStatusBar.setIdle(conn)
	}

	static SetRunningQuery(source : CancelTokenSource) {
		this.connectionStatusBar.setQueryRunning()
	}

	static SetNotRunnningQuery() {
		this.connectionStatusBar.setIdle(Status.Current)
	}
}
