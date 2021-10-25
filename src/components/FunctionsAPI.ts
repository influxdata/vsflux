/* eslint-disable @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any, dot-notation */
/* PLEASE NOTE BEFORE CONTINUING!
 *
 * This file is intended to be temporary. At the time, named functions/invocable scripts
 * is not supported in the API library. The code here is meant to _resemble_ what it will
 * likely look like, so that when (not if) the api client supports this, we can delete this
 * entire file and cut over to the library version of this.
 */
import { InfluxDB, Transport, SendOptions } from '@influxdata/influxdb-client'
import { RequestOptions } from '@influxdata/influxdb-client-apis'

function base64(value : string) : string {
    return Buffer.from(value, 'binary').toString('base64')
}

export class APIBase {
    transport : Transport
    constructor(influxDB : InfluxDB) {
        if (!influxDB) throw new Error('No influxDB supplied!')
        if (!influxDB.transport) throw new Error('No transport supplied!')
        this.transport = influxDB.transport
    }

    queryString(request : any, params : string[]) : string {
        if (request && params) {
            return params.reduce((acc, key) => {
                const val = request[key]
                if (val !== undefined && val !== null) {
                    acc += acc ? '&' : '?'
                    acc += encodeURIComponent(key) + '=' + encodeURIComponent(String(val))
                }
                return acc
            }, '')
        } else {
            return ''
        }
    }

    request(
        method : string,
        path : string,
        request : any = {},
        requestOptions ?: RequestOptions,
        mediaType ?: string
    ) : Promise<any> {
        const sendOptions : SendOptions = {
            ...requestOptions,
            method
        }
        if (mediaType) {
            (sendOptions.headers || (sendOptions.headers = {}))[
                'content-type'
            ] = mediaType
        }
        if (request.auth) {
            const value = `${request.auth.user}:${request.auth.password}`
                ; (sendOptions.headers || (sendOptions.headers = {}))[
                    'authorization'
                ] = `Basic ${base64(value)}`
        }
        return this.transport.request(
            path,
            request.body ? request.body : '',
            sendOptions,
            requestOptions?.responseStarted
        )
    }
}

export interface Script {
    id ?: string
    name : string
    description ?: string
    orgID : string
    script : string
    language ?: 'python' | 'flux'
    url ?: string
    createdAt ?: string
    updatedAt ?: string
}
type Scripts = Script[]
interface GetScriptsRequest {
    offset ?: number
    limit ?: number
    org ?: string
    orgID ?: string
}
interface GetScriptsResponse {
    scripts : Scripts
}
interface PostScriptsRequest {
    body : {
        name : string
        description : string
        orgID : string
        script : string
        language : 'python' | 'flux'
    }
}
type PostScriptsResponse = Script
interface GetScriptRequest {
    id : string
}
type GetScriptResponse = Script
interface PatchScriptRequest {
    id : string
    body : {
        name ?: string
        description ?: string
        script ?: string
    }
}
type PatchScriptResponse = Script
interface DeleteScriptRequest {
    id : string
}
interface ScriptInvocationParams {
    params ?: any
}
interface PostScriptsIDInvokeRequest {
    id : string
    body : ScriptInvocationParams
}

export class ScriptsAPI {
    private base : APIBase

    constructor(influxDB : InfluxDB) {
        this.base = new APIBase(influxDB)
    }

    getScripts(request ?: GetScriptsRequest, requestOptions ?: RequestOptions) : Promise<GetScriptsResponse> {
        return this.base.request(
            'GET',
            `/api/v2/scripts${this.base.queryString(request, [
                'offset',
                'limit',
                'descending',
                'org',
                'orgID',
                'userID'
            ])}`,
            request,
            requestOptions
        )
    }

    postScripts(request : PostScriptsRequest, requestOptions ?: RequestOptions) : Promise<Script> {
        return this.base.request(
            'POST',
            '/api/v2/scripts',
            request,
            requestOptions,
            'application/json'
        )
    }

    getScriptsID(request : GetScriptRequest, requestOptions ?: RequestOptions) : Promise<Script> {
        return this.base.request(
            'GET',
            `/api/v2/scripts/${request.id}`,
            request,
            requestOptions
        )
    }

    patchScriptsID(request : PatchScriptRequest, requestOptions ?: RequestOptions) : Promise<Script> {
        return this.base.request(
            'PATCH',
            `/api/v2/scripts/${request.id}`,
            request,
            requestOptions,
            'application/json'
        )
    }

    deleteScriptsID(request : DeleteScriptRequest, requestOptions ?: RequestOptions) : Promise<void> {
        return this.base.request(
            'DELETE',
            `/api/v2/scripts/${request.id}`,
            request,
            requestOptions
        )
    }

    postScriptsIDInvoke(request : PostScriptsIDInvokeRequest, requestOptions ?: RequestOptions) : Promise<void> {
        return this.base.request(
            'POST',
            `/api/v2/scripts/${request.id}/invoke`,
            request,
            requestOptions,
            'application/json'
        )
    }
}
