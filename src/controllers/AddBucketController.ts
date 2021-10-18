import * as vscode from 'vscode'
import * as path from 'path'
import * as Mustache from 'mustache'
import { RetentionRule } from '@influxdata/influxdb-client-apis'

import { APIClient } from '../components/APIClient'
import { IInstance } from '../types'
import { View } from '../views/View'

type AddBucketCallback = (name : string, duration ?: number) => void;
interface AddBucketMessage {
    readonly command : string;
    readonly name : string;
    readonly duration ?: string;
}

/* A form view for adding a new bucket. */
class AddBucketView extends View {
    public constructor(
        context : vscode.ExtensionContext
    ) {
        super(context, 'templates/addBucket.html')
    }

    public show(callback : AddBucketCallback) : void {
        const panel = vscode.window.createWebviewPanel(
            'InfluxDB',
            'Add bucket',
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

        const context = {
            cssPath: vscode.Uri.file(
                path.join(this.context.extensionPath, 'templates', 'form.css')
            ).with({ scheme: 'vscode-resource' }),
            jsPath: vscode.Uri.file(
                path.join(this.context.extensionPath, 'templates', 'addBucket.js')
            ).with({ scheme: 'vscode-resource' }),
            title: 'Add bucket'
        }
        panel.webview.html = Mustache.render(this.template, context)
        panel.webview.onDidReceiveMessage(async (message : AddBucketMessage) => {
            if (message.command !== 'saveNewBucket') {
                console.warn(`Unhandled message: ${message.command}`)
                return
            }
            let duration : number | undefined
            if (message.duration !== undefined) {
                duration = parseInt(message.duration)
            }
            callback(message.name, duration)
            panel.dispose()
        })
    }
}

/* Control the flow for the Add/Edit bucket flow, including presenting views, storing
 * process state, cleaning up resources, and restoring state.
 */
export class AddBucketController {
    constructor(
        private instance : IInstance,
        private context : vscode.ExtensionContext) {
        const addBucketView = new AddBucketView(this.context)
        addBucketView.show(this.addBucketCallback.bind(this))
    }

    private async addBucketCallback(name : string, duration : number | undefined) : Promise<void> {
        // XXX: rockstar (13 Sep 2021) - This makes me irrationally annoyed. The
        // postBuckets api requires an orgID, not an org, so we have to fetch
        // the orgID in order to create the bucket. The api clients are just very
        // inconsistent.
        const orgsAPI = new APIClient(this.instance).getOrgsApi()
        const organizations = await orgsAPI.getOrgs({ org: this.instance.org })
        if (!organizations || !organizations.orgs || !organizations.orgs.length || organizations.orgs[0].id === undefined) {
            console.error(`No organization named "${this.instance.org}" found!`)
            vscode.window.showErrorMessage('Unexpected error creating bucket')
            return
        }
        const orgID = organizations.orgs[0].id

        const bucketsApi = new APIClient(this.instance).getBucketsApi()
        const retentionRules : RetentionRule[] = []
        if (duration !== undefined) {
            retentionRules.push({ type: 'expire', shardGroupDurationSeconds: 0, everySeconds: duration })
        }
        await bucketsApi.postBuckets({
            body: {
                orgID,
                name,
                retentionRules
            }
        })
        vscode.commands.executeCommand('influxdb.refresh')
    }
}
