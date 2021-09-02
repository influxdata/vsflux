import * as vscode from 'vscode'
import * as path from 'path'
import * as Mustache from 'mustache'

import { View } from './View'

interface AddTaskMessage {
    readonly command : string;
    readonly name : string;
    readonly every : string | undefined;
    readonly cron : string | undefined;
    readonly offset : string;
}

type EditNewTaskCallback = (name : string, offset : string, every : string | undefined, cron : string | undefined) => void;

export class AddTaskView extends View {
    public constructor(
        context : vscode.ExtensionContext
    ) {
        super(context, 'templates/addTask.html')
    }

    public show(callback : EditNewTaskCallback) : void {
        const panel = vscode.window.createWebviewPanel(
            'InfluxDB',
            'Add task',
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
                path.join(this.context.extensionPath, 'templates', 'addTask.js')
            ).with({ scheme: 'vscode-resource' }),
            title: 'Add task'
        }
        panel.webview.html = Mustache.render(this.template, context)
        panel.webview.onDidReceiveMessage(async (message : AddTaskMessage) => {
            if (message.command !== 'saveNewTask') {
                console.warn(`Unhandled message: ${message.command}`)
                return
            }
            callback(message.name, message.offset, message.every, message.cron)
            panel.dispose()
        })
    }
}
