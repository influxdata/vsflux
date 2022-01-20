import { FluxTableMetaData } from '@influxdata/influxdb-client'
import * as vscode from 'vscode'
import * as path from 'path'
import { View } from '../views/View'
import { v1 as uuid } from 'uuid'
import { IInstance, InfluxVersion } from '../types'

import { APIClient } from '../components/APIClient'
import { Store } from '../components/Store'
import * as Mustache from 'mustache'

function getConfig() : vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('vsflux')
}

function defaultV1URL() : string {
    return getConfig()?.get<string>('defaultInfluxDBV1URL', '')
}

function defaultV2URLList() : string[] {
    return getConfig()?.get<string[]>('defaultInfluxDBURLs', [''])
}

class InstanceView extends View {
    private panel ?: vscode.WebviewPanel

    public constructor(
        context : vscode.ExtensionContext,
        private controller : AddInstanceController
    ) {
        super(context, 'templates/editConn.html')
    }

    public async edit(
        conn : IInstance
    ) : Promise<void> {
        return this.show('Edit Connection', conn)
    }

    public async create() : Promise<void> {
        return this.show('New Connection')
    }

    private async show(
        title : string,
        conn ?: IInstance | undefined
    ) : Promise<void> {
        this.panel = vscode.window.createWebviewPanel(
            'InfluxDB',
            title,
            vscode.ViewColumn.Active,
            {
                enableScripts: true,
                enableCommandUris: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(this.context.extensionPath, 'templates'))
                ],
                retainContextWhenHidden: true
            }
        )

        this.panel.webview.html = await this.html(conn, title)

        this.panel.webview.onDidReceiveMessage(this.controller.handleMessage.bind(this.controller))
    }

    private get cssPath() : vscode.Uri {
        return vscode.Uri.file(
            path.join(this.context.extensionPath, 'templates', 'form.css')
        ).with({ scheme: 'vscode-resource' })
    }

    private get jsPath() : vscode.Uri {
        return vscode.Uri.file(
            path.join(this.context.extensionPath, 'templates', 'editConn.js')
        ).with({ scheme: 'vscode-resource' })
    }

    private async html(
        conn : IInstance | undefined,
        title : string
    ) : Promise<string> {
        const context = {
            ...conn,
            title: title,
            cssPath: this.cssPath,
            jsPath: this.jsPath,
            isV1: false,
            defaultHostV1: defaultV1URL(),
            defaultHostLists: defaultV2URLList()

        }
        if (conn !== undefined) {
            context.isV1 = conn.version === InfluxVersion.V1
        }
        return Mustache.render(this.template, context)
    }

    public close() {
        if (this.panel !== undefined) {
            this.panel.dispose()
        }
    }
}

enum MessageType {
    Test = 'testConn',
    Save = 'save'
}
interface Message {
    readonly command : MessageType;
    readonly connID : string;
    readonly orgID : string;
    readonly connVersion : number;
    readonly connName : string;
    readonly connHost : string;
    readonly connToken : string;
    readonly connOrg : string;
    readonly connUser : string;
    readonly connPass : string;
    readonly connDisableTLS : boolean;
}

async function convertMessageToInstance(
    message : Message
) : Promise<IInstance> {
    let isActive = false
    if (message.connID !== '') {
        const store = Store.getStore()
        const instance = await store.getInstance(message.connID)
        isActive = instance.isActive
    }
    const instance = {
        version:
            message.connVersion > 0
                ? InfluxVersion.V1
                : InfluxVersion.V2,
        id: message.connID || uuid(),
        name: message.connName,
        hostNport: message.connHost,
        token: message.connToken,
        org: message.connOrg,
        orgID: message.orgID,
        user: message.connUser,
        pass: message.connPass,
        isActive,
        disableTLS: message.connDisableTLS
    }
    if (message.orgID === '') {
        const orgsAPI = new APIClient(instance).getOrgsApi()
        const organizations = await orgsAPI.getOrgs({ org: instance.org })
        if (!organizations || !organizations.orgs || !organizations.orgs.length || organizations.orgs[0].id === undefined) {
            console.error(`No organization named "${instance.org}" found!`)
        } else {
            instance.orgID = organizations.orgs[0].id
        }
    }
    return instance
}

export class AddInstanceController {
    private view : InstanceView

    constructor(
        private context : vscode.ExtensionContext,
        private instance ?: IInstance
    ) {
        this.view = new InstanceView(this.context, this)
        if (instance !== undefined) {
            this.view.edit(instance)
        } else {
            this.view.create()
        }
    }

    public async handleMessage(message : Message) : Promise<void> {
        const instance : IInstance = await convertMessageToInstance(message)
        switch (message.command) {
            case MessageType.Save: {
                const store = Store.getStore()
                const activeInstance = Object.values(store.getInstances()).filter((item : IInstance) => item.isActive)[0]
                if (activeInstance === undefined) {
                    // There is no currently active instance, meaning this
                    // is probably the first one. Set it to be active.
                    instance.isActive = true
                }
                await store.saveInstance(instance)

                this.view.close()
                vscode.commands.executeCommand('influxdb.refresh')
                break
            }
            case MessageType.Test: {
                if (instance.version === InfluxVersion.V2) {
                    try {
                        const queryApi = new APIClient(instance).getQueryApi()
                        const query = 'buckets()'
                        await new Promise<void>((resolve, reject) => {
                            queryApi.queryRows(query, {
                                next(_row : string[], _tableMeta : FluxTableMetaData) { }, // eslint-disable-line @typescript-eslint/no-empty-function
                                error(error : Error) {
                                    reject(error)
                                },
                                complete() {
                                    resolve()
                                }
                            })
                        })
                    } catch (e) {
                        vscode.window.showErrorMessage('Failed to connect to database')
                        console.error(e)
                    }
                } else {
                    const queryApi = new APIClient(instance).getV1Api()
                    try {
                        await queryApi.getDatabaseNames()
                        vscode.window.showInformationMessage('Connection successful')
                    } catch (e) {
                        vscode.window.showErrorMessage('Failed to connect to database')
                        console.error(e)
                    }
                }
                break
            }
            default:
                console.error(`Unhandled message type: ${message.command}`)
        }
    }
}
