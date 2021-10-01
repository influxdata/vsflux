import * as vscode from 'vscode'
import { InfluxDB, QueryApi } from '@influxdata/influxdb-client'
import * as InfluxDB1 from 'influx'
import { BucketsAPI, OrgsAPI, TasksAPI } from '@influxdata/influxdb-client-apis'

import { IInstance, InfluxVersion } from '../types'

// XXX: rockstar (30 Sep 2021) - the following is why we self-medicate.
// VSCode is an electron app, and a node and electron both ship with their
// own list of root CAs. Today was the day that a LetsEncrypt root CA expired,
// and the newer root CA is not bundled in with electron and/or the server side
// is not fully using the new root CA--I can't be sure of either. For now,
// including this CA cert in the agent of the request will fix that issue and
// not block users. It is awful and I will never forgive myself. See also,
// https://letsencrypt.org/docs/dst-root-ca-x3-expiration-september-2021/
// https://community.letsencrypt.org/t/issues-with-electron-and-expired-root/160991
// https://github.com/electron/electron/issues/31212
const ISRGCAs = [`-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu
ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY
MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc
h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+
0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U
A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW
T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH
B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC
B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv
KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn
OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn
jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw
qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI
rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV
HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq
hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL
ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ
3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK
NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5
ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur
TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC
jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc
oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq
4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA
mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d
emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=
-----END CERTIFICATE-----`]
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
            ca: ISRGCAs,
            headers: {
                'User-agent': `influxdb-client-vscode/${version}`
            },
            rejectUnauthorized: !(instance.disableTLS)
        }
    }

    private getInfluxDB() : InfluxDB {
        if (this.instance.version !== InfluxVersion.V2) {
            throw Error('Could not get InfluxDB 2.x api handler for 1.x instance')
        }
        return new InfluxDB({ url: this.instance.hostNport, token: this.instance.token, transportOptions: this.transportOptions })
    }

    getV1Api() : InfluxDB1.InfluxDB {
        if (this.instance.version !== InfluxVersion.V1) {
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
