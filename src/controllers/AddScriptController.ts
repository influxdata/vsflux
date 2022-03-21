import * as crypto from 'crypto'
import * as Mustache from 'mustache'
import * as os from 'os'
import * as path from 'path'
import * as vscode from 'vscode'
import { Script } from '@influxdata/influxdb-client-apis'
import { promises as fs } from 'fs'

import { IInstance } from '../types'
import { View } from '../views/View'
import { APIClient } from '../components/APIClient'

interface AddScriptMessage {
    readonly command : string,
    readonly name : string,
    readonly description : string,
    readonly language : 'flux'
}

class AddScriptView extends View {
    private panel ?: vscode.WebviewPanel

    constructor(
        context : vscode.ExtensionContext,
        private controller : AddScriptController
    ) {
        super(context, 'templates/addScript.html')
    }

    public show() : void {
        this.panel = vscode.window.createWebviewPanel(
            'InfluxDB',
            'Add script',
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
                path.join(this.context.extensionPath, 'templates', 'addScript.js')
            ).with({ scheme: 'vscode-resource' }),
            title: 'Add script'
        }

        this.panel.webview.html = Mustache.render(this.template, context)
        this.panel.webview.onDidReceiveMessage(this.controller.handleMessage.bind(this.controller))
    }

    public destroy() : void {
        if (this.panel !== undefined) {
            this.panel.dispose()
        }
    }
}

export class AddScriptController {
    private view : AddScriptView

    constructor(
        private instance : IInstance,
        private context : vscode.ExtensionContext
    ) {
        this.view = new AddScriptView(this.context, this)
    }

    public addScript() : void {
        this.view.show()
    }

    public async editScript(script : Script) : Promise<void> {
        if (script.id === undefined) {
            console.error('AddScriptController.editScript called on script without id')
            return
        }
        const tmpdir = path.join(os.tmpdir(), crypto.randomBytes(10).toString('hex'))
        await fs.mkdir(tmpdir)
        const newFile = vscode.Uri.parse(path.join(tmpdir, `${script.name.replace(path.sep, '-')}.flux`))
        await fs.writeFile(newFile.path, '')
        const document = await vscode.workspace.openTextDocument(newFile.path)
        const self = this // eslint-disable-line @typescript-eslint/no-this-alias
        const saveListener = vscode.workspace.onDidSaveTextDocument(async (saved : vscode.TextDocument) : Promise<void> => {
            if (saved === document) {
                enum SaveOptions {
                    SaveAndClose = 'Save and close',
                    Save = 'Save',
                }
                const confirmation = await vscode.window.showInformationMessage(
                    `Save ${script.name} in ${self.instance.name}?`, {
                    modal: true
                }, SaveOptions.Save, SaveOptions.SaveAndClose)
                switch (confirmation) {
                    case SaveOptions.Save:
                        break

                    case SaveOptions.SaveAndClose:
                        break

                    default:
                        return
                }
                // XXX: rockstar (22 Oct 2021) - trimEnd() because see this bug:
                // https://github.com/influxdata/idpe/issues/12147
                const textContents = saved.getText().trimEnd()

                const scriptsAPI = new APIClient(this.instance).getScriptsApi()
                await scriptsAPI.patchScriptsID({
                    scriptID: script.id!, // eslint-disable-line @typescript-eslint/no-non-null-assertion
                    body: {
                        script: textContents
                    }
                })
                if (confirmation === SaveOptions.SaveAndClose) {
                    saveListener.dispose()
                    await fs.rmdir(tmpdir, { recursive: true })
                    vscode.commands.executeCommand('workbench.action.closeActiveEditor')
                }
                vscode.commands.executeCommand('influxdb.refresh')
            }
        })
        const closeListener = vscode.workspace.onDidCloseTextDocument(async (closed : vscode.TextDocument) : Promise<void> => {
            if (closed === document) {
                closeListener.dispose()
                saveListener.dispose()
                await fs.rmdir(tmpdir, { recursive: true })
                vscode.commands.executeCommand('influxdb.refresh')
            }
        })
        const edit = new vscode.WorkspaceEdit()
        edit.insert(newFile, new vscode.Position(0, 0), `${script.script}\n\n`)
        const success = await vscode.workspace.applyEdit(edit)
        if (success) {
            vscode.window.showTextDocument(document)
        } else {
            vscode.window.showErrorMessage('Could not open script for editing.')
        }
    }

    public async handleMessage(message : AddScriptMessage) : Promise<void> {
        if (message.command !== 'saveScript') {
            console.warn(`Unhandled message: ${message.command}`)
            return
        }
        this.view.destroy()

        const tmpdir = path.join(os.tmpdir(), crypto.randomBytes(10).toString('hex'))
        await fs.mkdir(tmpdir)
        const newFile = vscode.Uri.parse(path.join(tmpdir, `${message.name.replace(path.sep, '-')}.flux`))
        await fs.writeFile(newFile.path, '')
        const document = await vscode.workspace.openTextDocument(newFile.path)
        const self = this // eslint-disable-line @typescript-eslint/no-this-alias
        const saveListener = vscode.workspace.onDidSaveTextDocument(async (saved : vscode.TextDocument) : Promise<void> => {
            if (saved === document) {
                const saveText = 'Create and close'
                const confirmation = await vscode.window.showInformationMessage(
                    `Create ${message.name} script in ${self.instance.name}?`, {
                    modal: true
                }, saveText)
                if (confirmation !== saveText) {
                    return
                }
                const script = saved.getText()

                const scriptsAPI = new APIClient(this.instance).getScriptsApi()
                await scriptsAPI.postScripts({
                    body: {
                        name: message.name,
                        description: message.description,
                        language: message.language,
                        script
                    }
                })
                saveListener.dispose()
                await fs.rmdir(tmpdir, { recursive: true })
                vscode.commands.executeCommand('workbench.action.closeActiveEditor')
                vscode.commands.executeCommand('influxdb.refresh')
            }
        })
        const closeListener = vscode.workspace.onDidCloseTextDocument(async (closed : vscode.TextDocument) : Promise<void> => {
            if (closed === document) {
                closeListener.dispose()
                saveListener.dispose()
                await fs.rmdir(tmpdir, { recursive: true })
                vscode.commands.executeCommand('influxdb.refresh')
            }
        })
        vscode.window.showTextDocument(document)
    }
}
