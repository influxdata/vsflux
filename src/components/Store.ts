import { notDeepStrictEqual } from 'assert'
import * as childProcess from 'child_process'
import * as vscode from 'vscode'

import { IInstance, IMigration, InfluxVersion } from '../types'
import { Instance } from '../views/TreeView'

const InfluxDBInstancesKey = 'influxdb.connections'
const InfluxDBMigrationsKey = 'influxdb.migrations'

interface CLIConfig {
    url: string;
    token: string;
    org: string;
    active?: boolean;
}

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

    async getInstances() : Promise<{ [key : string] : IInstance }> {
        const instances = this.context.globalState.get<{
            [key : string] : IInstance;
        }>(InfluxDBInstancesKey) || {};

        return new Promise<{ [key : string] : IInstance }>((resolve, reject) => {
            // Try to load any CLI configurations and add them as available connections
            childProcess.exec('influx config list --json', (error, stdout) => {
                // Just ignore the error as the user likely just do not have the CLI installed
                if (!error) {
                    try {
                        const json: { [key: string]: CLIConfig } = JSON.parse(stdout)
                        for (const [id, config] of Object.entries(json)) {
                            const cliInstance = {
                                id,
                                version: InfluxVersion.V2,
                                token: config.token,
                                org: config.org,
                                hostNport: config.url,
                                isActive: false,
                                disableTLS: false,
                                name: id,
                                user: '',
                                pass: '',
                                cli: true
                            }
                            const instance = instances[cliInstance.id]
                            // Reuse the instance if it exists in the vscode configuration because we loaded it earlier
                            if (instance && instance.cli) {
                                cliInstance.isActive = instance.isActive
                                instances[cliInstance.id] = cliInstance
                                continue
                            }
                            instances[instance.id] = cliInstance
                        }
                    } catch (error) {
                        reject(error)
                        return
                    }
                }
                resolve(instances)
            })
        })
    }

    async getInstance(id : string) : Promise<IInstance> {
        return (await this.getInstances())[id]
    }

    async saveInstance(connection : IInstance) : Promise<void> {
        const connections = await this.getInstances()
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
        const connections = await this.getInstances()
        const connection = connections[id]
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

    getAppliedMigrations() : { [key : string] : IMigration } {
        return this.context.globalState.get<{
            [key : string] : IMigration;
        }>(InfluxDBMigrationsKey) || {}
    }

    async setAppliedMigration(name : string) : Promise<void> {
        const migrations = this.getAppliedMigrations()
        if (migrations[name] !== undefined) {
            console.error(`Attempt to overwrite an existing migration: ${name}`)
            return
        }
        const migration = {
            name,
            appliedOn: new Date()
        }
        migrations[name] = migration
        await this.context.globalState.update(InfluxDBMigrationsKey, migrations)
    }
}
