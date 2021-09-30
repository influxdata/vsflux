import * as vscode from 'vscode'

import { Store } from './Store'
import { IInstance } from '../types'
import { TableView } from '../views/TableView'
import { QueryResult } from '../models'
import { APIClient } from './APIClient'

export async function runQuery(query : string, context : vscode.ExtensionContext) : Promise<void> {
    try {
        const store = Store.getStore()
        const instance = Object.values(store.getInstances()).filter((item : IInstance) => item.isActive)[0]
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
