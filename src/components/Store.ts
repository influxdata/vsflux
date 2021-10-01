import { consoleLogger } from '@influxdata/influxdb-client'
import * as vscode from 'vscode'

import { IConnection } from '../types'

const InfluxDBConnectionsKey = 'influxdb.connections'

/*
 * An interface for querying and saving data to various Code data stores.
 */
export class Store {
    static store : Store | undefined

    constructor(private context : vscode.ExtensionContext) { }

    static init(context : vscode.ExtensionContext) : void {
        this.store = new Store(context)
    }

    static getStore() : Store {
        if (!this.store) {
            throw new Error('Store unitialized. Cannot get store')
        }
        return this.store
    }

    getConnections() : { [key : string] : IConnection } {
        return this.context.globalState.get<{
            [key : string] : IConnection;
        }>(InfluxDBConnectionsKey) || {}
    }

    getConnection(id : string) : IConnection {
        return this.getConnections()[id]
    }

    async saveConnection(connection : IConnection) : Promise<void> {
        const connections = this.getConnections()
        if (connection.isActive) {
            // Ensure no other connection is marked active
            for (const [key, _] of Object.entries(connections)) {
                if (key !== connection.id) {
                    connections[key].isActive = false
                }
            }
        }
        connections[connection.id] = connection
        await this.context.globalState.update(InfluxDBConnectionsKey, connections)
    }

    async deleteConnection(id : string) : Promise<void> {
        const connections = this.getConnections()
        const connection = this.getConnection(id)
        if (connection.isActive) {
            // Set a new active connection
            for (const [key, _] of Object.entries(connections)) {
                if (key !== connection.id) {
                    connections[key].isActive = true
                    break
                }
            }
        }
        delete connections[id]
        await this.context.globalState.update(InfluxDBConnectionsKey, connections)
    }
}
