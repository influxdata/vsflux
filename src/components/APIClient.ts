import * as vscode from 'vscode'
import { InfluxDB, QueryApi } from '@influxdata/influxdb-client'
import * as InfluxDB1 from 'influx'
import { BucketsAPI, OrgsAPI, TasksAPI } from '@influxdata/influxdb-client-apis'

import { IInstance, InfluxVersion } from '../types'

const version = vscode.extensions.getExtension('influxdata.flux')?.packageJSON.version

/* APIClient encapsulates all the functionality needed to make connections to
   InfluxDB instances.
 */
export class APIClient {
    private transportOptions : { [key : string] : any }

    constructor(private instance : IInstance) {
        this.transportOptions = {
            rejectUnauthorized: !(instance.disableTLS),
            headers: {
                'User-agent': `influxdb-client-vscode/${version}`
            }
        }
        console.log(this.transportOptions)
    }

    private getInfluxDB() : InfluxDB {
        if (this.instance.version != InfluxVersion.V2) {
            throw Error('Could not get InfluxDB 2.x api handler for 1.x instance')
        }
        return new InfluxDB({ url: this.instance.hostNport, token: this.instance.token, transportOptions: this.transportOptions })
    }

    getV1Api() : InfluxDB1.InfluxDB {
        if (this.instance.version != InfluxVersion.V1) {
            throw Error('Could not get InfluxDB 1.x api handler for 2.x instance')
        }
        const hostSplit : string[] = vscode.Uri.parse(this.instance.hostNport).authority.split(':')
        if (hostSplit.length > 1) {
            return new InfluxDB1.InfluxDB({
                host: hostSplit[0], port: parseInt(hostSplit[1]), username: this.instance.user, password: this.instance.pass
            })
        } else {
            return new InfluxDB1.InfluxDB({
                host: hostSplit[0], username: this.instance.user, password: this.instance.pass
            })
        }
    }
    getQueryApi() : QueryApi {
        return this.getInfluxDB().getQueryApi({ org: this.instance.org })
    }
    getTasksApi() : TasksAPI {
        return new TasksAPI(this.getInfluxDB())
    }
    getBucketsApi() : BucketsAPI {
        return new BucketsAPI(this.getInfluxDB())
    }
    getOrgsApi() : OrgsAPI {
        return new OrgsAPI(this.getInfluxDB())
    }
}