import * as vscode from 'vscode'
import * as path from 'path'
import * as Mustache from 'mustache'

import { View } from './View'

interface AddBucketMessage {
    readonly command : string;
    readonly name : string;
    readonly duration?: string;
}

type AddBucketCallback = (name : string, duration?: number) => void;

export class AddBucketView extends View {
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
