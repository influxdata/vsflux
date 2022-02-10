import { exec as _exec } from 'child_process'
import * as util from 'util'
import * as vscode from 'vscode'

import { IInstance, IMigration, InfluxVersion } from '../types'

const exec = util.promisify(_exec)

const InfluxDBInstancesKey = 'influxdb.connections'
const InfluxDBMigrationsKey = 'influxdb.migrations'

interface CLIInstance {
    url : string;
    token : string;
    org : string;
    active ?: boolean;
}

export enum InstanceDataSource {
    CLI = 'cli',
    DB = 'db'
}

/*
 * An interface for querying and saving data to various Code data stores.
 */
export class Store {
    // eslint-disable-next-line no-use-before-define
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

    // Get the config. Don't cache this, otherwise we'd have to set up change
    // event listeners.
    get config() : vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration('vsflux')
    }

    async getInstances() : Promise<{ [key : string] : IInstance }> {
        const dataSource = this.config.get<string>('datasource', InstanceDataSource.DB)
        if (dataSource === InstanceDataSource.CLI) {
            const { stdout, stderr } = await exec('influx config list --json')
            if (stderr) {
                console.error(`Error from influx cli: ${stdout}`)
                vscode.window.showErrorMessage('Error invoking the influx command')
                return {}
            }

            const cliData : { [key : string] : CLIInstance } = JSON.parse(stdout)
            const instances : { [key : string] : IInstance } = {}
            for (const [id, config] of Object.entries(cliData)) {
                instances[id] = {
                    id,
                    disableTLS: false,
                    hostNport: config.url,
                    name: id,
                    org: config.org,
                    token: config.token,
                    isActive: config.active !== undefined ? config.active : false
                }
            }
            return instances
        } else {
            return this.context.globalState.get<{
                [key : string] : IInstance;
            }>(InfluxDBInstancesKey) || {}
        }
    }

    async getInstance(id : string) : Promise<IInstance> {
        const instances = await this.getInstances()
        return instances[id]
    }

    async saveInstance(connection : IInstance) : Promise<void> {
        const connections = await this.getInstances()
        const dataSource = await this.config.get<string>('datasource', InstanceDataSource.DB)
        if (dataSource === InstanceDataSource.CLI) {
            if (connections[connection.id] === undefined) { // New instance
                const createCommand = `influx config create \
                    --config-name "${connection.name}" \
                    --host-url ${connection.hostNport} \
                    --token ${connection.token} \
                    --org "${connection.org}"`
                const { stdout, stderr } = await exec(createCommand)
                if (stderr) {
                    console.error(`Error from influx cli: ${stdout}`)
                    vscode.window.showErrorMessage('Error invoking the influx command')
                }
            } else {
                let updateCommand = `influx config update \
                    --config-name "${connection.id}" \
                    --host-url ${connection.hostNport} \
                    --token ${connection.token} \
                    --org "${connection.org}"`
                if (connection.isActive) {
                    updateCommand = `${updateCommand} --active`
                }
                const { stdout, stderr } = await exec(updateCommand)
                if (stderr) {
                    console.error(`Error from influx cli: ${stdout}`)
                    vscode.window.showErrorMessage('Error invoking the influx command')
                }
            }
        } else {
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
    }

    async deleteInstance(id : string) : Promise<void> {
        const dataSource = this.config.get<string>('datasource', InstanceDataSource.DB)
        if (dataSource === InstanceDataSource.CLI) {
            const { stdout, stderr } = await exec(`influx config rm "${id}"`)
            if (stderr) {
                console.error(`Error from influx cli: ${stdout}`)
                vscode.window.showErrorMessage('Error invoking the influx command')
            }
        } else {
            const connections = await this.getInstances()
            const connection = await this.getInstance(id)
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
