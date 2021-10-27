import * as vscode from 'vscode'

import { APIClient } from './APIClient'
import { IMigration, InfluxVersion } from '../types'
import { Store } from './Store'

type MigrationFunc = (store : Store) => Promise<void>
type Migration = {
    name : string,
    func : MigrationFunc
}
const migrations : Migration[] = []

export class MigrationManager {
    store : Store
    appliedMigrations : { [key : string] : IMigration }

    constructor() {
        this.store = Store.getStore()

        this.appliedMigrations = this.store.getAppliedMigrations()
    }

    async migrate() : Promise<void> {
        migrations.forEach(async ({ name, func }) => {
            if (Object.keys(this.appliedMigrations).indexOf(name) === -1) {
                console.debug(`Applying "${name}" migration`)
                try {
                    await func(this.store)
                    await this.store.setAppliedMigration(name)
                } catch (e) {
                    console.error(e)
                }
            }
        })
        vscode.commands.executeCommand('influxdb.refresh')
    }
}

async function migrateOrgID(store : Store) : Promise<void> {
    const instances = store.getInstances()
    Object.entries(instances).forEach(async ([_id, instance], _idx) => {
        if (instance.version === InfluxVersion.V2 && instance.orgID === undefined) {
            const orgsAPI = new APIClient(instance).getOrgsApi()
            const organizations = await orgsAPI.getOrgs({ org: instance.org })
            if (!organizations || !organizations.orgs || !organizations.orgs.length || organizations.orgs[0].id === undefined) {
                throw Error(`No organization named "${instance.org}" found!`)
            }
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const orgID = organizations.orgs[0].id!
            const newInstance = {
                ...instance,
                orgID
            }
            await store.saveInstance(newInstance)
        }
    })
}
migrations.push({ name: 'migrateOrgId', func: migrateOrgID })
