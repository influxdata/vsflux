import * as vscode from 'vscode'
import { InfluxDB } from '@influxdata/influxdb-client'

import { Store } from './Store'
import { IInstance } from '../types'
import { TableView } from '../views/TableView'
import { QueryResult } from '../models'

export async function runQuery(query : string, context : vscode.ExtensionContext) : Promise<void> {
    try {
        const store = Store.getStore()
        const connection = Object.values(store.getInstances()).filter((item : IInstance) => item.isActive)[0]
        const transportOptions = { rejectUnauthorized: true }
        if (connection.disableTLS !== undefined && connection.disableTLS) {
            transportOptions.rejectUnauthorized = false
        }
        const queryApi = new InfluxDB({ url: connection.hostNport, token: connection.token, transportOptions }).getQueryApi(connection.org)
        const results = await QueryResult.run(queryApi, query)
        const tableView = new TableView(context)
        tableView.show(results, connection.name)
    } catch (error) {
        let errorMessage = 'Error executing query'
        if (error instanceof Error) {
            errorMessage = error.message
        }
        vscode.window.showErrorMessage(errorMessage)
        console.error(error)
    }
}
