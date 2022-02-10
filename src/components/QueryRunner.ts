import * as vscode from 'vscode'

import { Store } from './Store'
import { IInstance } from '../types'
import { TableView } from '../views/TableView'
import { QueryResult } from '../models'
import { APIClient } from './APIClient'

/* Take a flux query, execute it against the currently active Instance, and show the results. */
export async function runQuery(query : string, context : vscode.ExtensionContext) : Promise<void> {
    try {
        const store = Store.getStore()

        const instances = await store.getInstances()
        const instance = Object.values(instances).filter((item : IInstance) => item.isActive)[0]
        if (instance === undefined) {
            vscode.window.showErrorMessage(
                'No connection selected to query against. Please select a connection in the InfluxDB pane and try again.')
            return
        }
        const queryApi = new APIClient(instance).getQueryApi()
        const results = await QueryResult.run(queryApi, query)
        const tableView = new TableView(context)
        tableView.show(results, instance.name)
    } catch (error) {
        let errorMessage = 'Error executing query'
        if (error instanceof Error) {
            errorMessage = error.message
        }
        vscode.window.showErrorMessage(errorMessage)
        console.error(error)
    }
}
