/* eslint-disable @typescript-eslint/no-empty-function, @typescript-eslint/no-explicit-any */
import * as assert from 'assert'

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode'
import * as vsflux from '../../extension'

class FauxEnvironmentVariableCollection {
    persistent = false
    replace(_variable : string, _value : string) : void { }
    append(_variable : string, _value : string) : void { }
    prepend(_variable : string, _value : string) : void { }
    get(_variable : string) : vscode.EnvironmentVariableMutator | undefined { return undefined }
    forEach(_callback : (variable : string, mutator : vscode.EnvironmentVariableMutator, collection : vscode.EnvironmentVariableCollection) => any, _thisArg ?: any) : void { }
    delete(_variable : string) : void { }
    clear() : void { }
}

class FauxMemento {
    private data : { [key : string] : any }

    constructor() {
        this.data = {}
    }

    keys() : string[] {
        return Object.keys(this.data)
    }

    get<T>(key : string) : T | undefined;
    get<T>(key : string, defaultValue : T) : T;
    get<T>(key : string, defaultValue ?: T) : T | undefined {
        if (this.keys().includes(key) || defaultValue === undefined) {
            return this.get(key) as T
        } else {
            return defaultValue
        }
    }

    update(key : string, value : any) : Thenable<void> {
        return new Promise((resolve, _reject) => {
            this.data[key] = value
            resolve()
        })
    }

    setKeysForSync(_keys : readonly string[]) : void { }
}

class FauxSecretStorage {
    onDidChange : vscode.Event<vscode.SecretStorageChangeEvent>

    constructor() {
        this.onDidChange = (_listener : (e : vscode.SecretStorageChangeEvent) => any, _thisArgs ?: any, _disposables ?: vscode.Disposable[]) : vscode.Disposable => {
            return new vscode.Disposable(() => { })
        }
    }

    get(_key : string) : Thenable<string | undefined> {
        return new Promise((resolve, _reject) => { resolve(undefined) })
    }

    store(_key : string, _value : string) : Thenable<void> {
        return new Promise((resolve, _reject) => { resolve() })
    }

    delete(_key : string) : Thenable<void> {
        return new Promise((resolve, _reject) => { resolve() })
    }
}

// A class adhering to the vscode.ExtensionContext interface
class FauxContext {
    constructor() {
        this.subscriptions = []

        this.extensionMode = vscode.ExtensionMode.Test
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.extension = vscode.extensions.getExtension('influxdata.flux')!
        this.extensionPath = this.globalStoragePath = this.logPath = 'mock-string'
        this.extensionUri = this.globalStorageUri = this.logUri = vscode.Uri.parse('file:///path/to/mock/uri')

        this.workspaceState = this.globalState = new FauxMemento()
        this.secrets = new FauxSecretStorage()
        this.environmentVariableCollection = new FauxEnvironmentVariableCollection()
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly subscriptions : { dispose() : any }[]

    readonly workspaceState : vscode.Memento

    readonly globalState : vscode.Memento & {
        setKeysForSync(keys : readonly string[]) : void;
    }

    readonly secrets : vscode.SecretStorage

    readonly extensionUri : vscode.Uri

    readonly extensionPath : string

    readonly environmentVariableCollection : vscode.EnvironmentVariableCollection

    asAbsolutePath(relativePath : string) : string {
        return `/an/absolute/path/${relativePath}`
    }

    readonly storageUri : vscode.Uri | undefined

    readonly storagePath : string | undefined

    readonly globalStorageUri : vscode.Uri

    readonly globalStoragePath : string

    readonly logUri : vscode.Uri

    readonly logPath : string

    readonly extensionMode : vscode.ExtensionMode

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly extension : vscode.Extension<any>
}

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.')

    test('extension activate', () => {
        const context = new FauxContext()
        try {
            vsflux.activate(context)
        } catch (e) {
            assert.equal('', e)
        }

        // There are 23 subscriptions that should be activated as part of this run.
        assert.equal(context.subscriptions.length, 23)
    })
})
