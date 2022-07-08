import { FluxTableMetaData } from '@influxdata/influxdb-client'
import * as vscode from 'vscode'
import * as path from 'path'
import { View } from '../views/View'
import { v1 as uuid } from 'uuid'
import { IInstance, InfluxVersion } from '../types'

import { APIClient } from '../components/APIClient'
import { Store, InstanceDataSource } from '../components/Store'
import * as Mustache from 'mustache'

function defaultV2URLList() : string[] {
    return Store.getStore().config?.get<string[]>('defaultInfluxDBURLs', [''])
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

        const cssPath = this.panel.webview.asWebviewUri(vscode.Uri.file(
            path.join(this.context.extensionPath, 'templates', 'form.css')
        ))

        const jsPath = this.panel.webview.asWebviewUri(vscode.Uri.file(
            path.join(this.context.extensionPath, 'templates', 'editConn.js')
        ))

        const context = {
            ...conn,
            title: title,
            cssPath: cssPath,
            jsPath: jsPath,
            isV1: false,
            defaultHostLists: defaultV2URLList(),
            canDisableTLS: Store.getStore().config?.get<string>('datasource') === InstanceDataSource.DB,
            readonly: conn !== undefined ? conn.id === conn.name : false
        }

        this.panel.webview.html = Mustache.render(this.template, context)

        this.panel.webview.onDidReceiveMessage(this.controller.handleMessage.bind(this.controller))
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
    readonly connName : string;
    readonly connHost : string;
    readonly connToken : string;
    readonly connOrg : string;
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
        id: message.connID || uuid(),
        name: message.connName,
        hostNport: message.connHost,
        token: message.connToken,
        org: message.connOrg,
        orgID: message.orgID,
        isActive,
        disableTLS: message.connDisableTLS
    }
    try {
        if (message.orgID === '') {
            const orgsAPI = new APIClient(instance).getOrgsApi()
            const organizations = await orgsAPI.getOrgs({ org: instance.org })
            if (!organizations || !organizations.orgs || !organizations.orgs.length || organizations.orgs[0].id === undefined) {
                console.error(`No organization named "${instance.org}" found!`)
            } else {
                instance.orgID = organizations.orgs[0].id
            }
        }
    } catch (e) {
        console.error(e)
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
        switch (message.command) {
            case MessageType.Save: {
                const instance : IInstance = await convertMessageToInstance(message)
                if (instance.orgID === '') {
                    vscode.window.showErrorMessage('Could not fetch resources from database. Please check your connection and try again.')
                    return
                }
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
            default:
                console.error(`Unhandled message type: ${message.command}`)
        }
    }
}
