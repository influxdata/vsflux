import * as vscode from 'vscode'
import { InfluxDB, QueryApi } from '@influxdata/influxdb-client'
import { BucketsAPI, OrgsAPI, TasksAPI, ScriptsAPI, FluxScriptInvocationAPI } from '@influxdata/influxdb-client-apis'

import { IInstance } from '../types'

const version = vscode.extensions.getExtension('influxdata.flux')?.packageJSON.version

/* APIClient encapsulates all the functionality needed to make connections to
   InfluxDB instances.
 */
export class APIClient {
    // This `any` is how the transport options are expressed in the
    // client library.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private transportOptions : { [key : string] : any }

    constructor(private instance : IInstance) {
        this.transportOptions = {
            headers: {
                'User-agent': `influxdb-client-vscode/${version}`
            },
            rejectUnauthorized: !(instance.disableTLS)
        }
    }

    private getInfluxDB() : InfluxDB {
        return new InfluxDB({
            url: this.instance.hostNport,
            token: this.instance.token,
            timeout: 30 * 1000, // Match the web UI
            transportOptions: this.transportOptions
        })
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

    getScriptsApi() : ScriptsAPI {
        return new ScriptsAPI(this.getInfluxDB())
    }

    getScriptInvocationApi() : FluxScriptInvocationAPI {
        return new FluxScriptInvocationAPI(this.getInfluxDB())
    }
}
