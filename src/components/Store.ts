import { consoleLogger } from '@influxdata/influxdb-client'
import * as vscode from 'vscode'

import { IInstance } from '../types'

const InfluxDBInstancesKey = 'influxdb.connections'

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

    getInstances() : { [key : string] : IInstance } {
        return this.context.globalState.get<{
            [key : string] : IInstance;
        }>(InfluxDBInstancesKey) || {}
    }

    getInstance(id : string) : IInstance {
        return this.getInstances()[id]
    }

    async saveInstance(connection : IInstance) : Promise<void> {
        const connections = this.getInstances()
        if (connection.isActive) {
            // Ensure no other connection is marked active
            for (const [key, _] of Object.entries(connections)) {
                if (key !== connection.id) {
                    connections[key].isActive = false
                }
            }
        }
        connections[connection.id] = connection
        await this.context.globalState.update(InfluxDBInstancesKey, connections)
    }

    async deleteInstance(id : string) : Promise<void> {
        const connections = this.getInstances()
        const connection = this.getInstance(id)
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
        await this.context.globalState.update(InfluxDBInstancesKey, connections)
    }
}
