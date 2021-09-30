import * as vscode from 'vscode'
import { LoggingDebugSession, TerminatedEvent, InitializedEvent } from 'vscode-debugadapter'
import { DebugProtocol } from 'vscode-debugprotocol'
import { InfluxDB } from '@influxdata/influxdb-client'

import { Store } from '../components/Store'
import { IConnection } from '../types'
import { QueryResult } from '../models'
import { TableView } from '../views/TableView'
import { runQuery } from './QueryRunner'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Subject } = require('await-notify') // await-notify doesn't provide types, and we don't allow implicit any

interface ILaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
    query : string;
}

/*
 * The core logic of the debug adapter, DebugSession provides an interface for
 * executing flux. It is meant to be a temporary solution to allow F5-to-run abilities,
 * but does not provide any actual debugging. This interface will eventually be replaced
 * by a wasm server with more capabilities.
 */
class DebugSession extends LoggingDebugSession {
    private configurationDone = new Subject()

    public constructor(private context : vscode.ExtensionContext) {
        super('')
    }

    /**
     * The 'initialize' request is the first request called by the frontend
     * to interrogate the features the debug adapter provides.
     */
    protected initializeRequest(response : DebugProtocol.InitializeResponse, _args : DebugProtocol.InitializeRequestArguments) : void {
        response.body = response.body || {}
        response.body.supportsConfigurationDoneRequest = true
        response.body.supportsEvaluateForHovers = false
        response.body.supportsStepBack = false
        response.body.supportsDataBreakpoints = false
        response.body.supportsCompletionsRequest = false
        response.body.completionTriggerCharacters = []
        response.body.supportsCancelRequest = false
        response.body.supportsBreakpointLocationsRequest = false
        response.body.supportsStepInTargetsRequest = false
        response.body.supportsExceptionFilterOptions = false
        response.body.exceptionBreakpointFilters = []

        // make VS Code send exceptionInfo request
        response.body.supportsExceptionInfoRequest = false

        // make VS Code send setVariable request
        response.body.supportsSetVariable = false

        // make VS Code send setExpression request
        response.body.supportsSetExpression = false

        // make VS Code send disassemble request
        response.body.supportsDisassembleRequest = false
        response.body.supportsSteppingGranularity = false
        response.body.supportsInstructionBreakpoints = false

        this.sendResponse(response)

        // Notify the client that the initialization is complete, which signals the ability to accept
        // configuration requests at any time. The client will signal the end of its configuration sequence by
        // sending a `configurationDone` request.
        this.sendEvent(new InitializedEvent())
    }

    /**
     * Called at the end of the configuration sequence.
     * Indicates that all breakpoints etc. have been sent to the DA and that the 'launch' can start.
     */
    protected configurationDoneRequest(response : DebugProtocol.ConfigurationDoneResponse, args : DebugProtocol.ConfigurationDoneArguments) : void {
        super.configurationDoneRequest(response, args)

        // notify the launchRequest that configuration has finished
        this.configurationDone.notify()
    }

    protected async launchRequest(response : DebugProtocol.LaunchResponse, args : ILaunchRequestArguments) : Promise<void> {
        // Ensure that the client is done configuring itself before executing
        await this.configurationDone.wait(1000)

        // Execute the flux
        runQuery(args.query, this.context)

        this.sendResponse(response)

        // Currently, this is a "Run only" interface, with no debugging characteristics. Once it has run,
        // there is nothing left to do. Terminate the connection to the client.
        this.sendEvent(new TerminatedEvent())
    }
}

class InlineDebugAdapterFactory implements vscode.DebugAdapterDescriptorFactory {
    constructor(private context : vscode.ExtensionContext) { }

    createDebugAdapterDescriptor(_session : vscode.DebugSession) : vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
        return new vscode.DebugAdapterInlineImplementation(new DebugSession(this.context))
    }
}

class FluxDebugConfigurationProvider implements vscode.DebugConfigurationProvider {
    /**
     * If launch.json doesn't exist or is empty (most cases), massage the config to contain all the needed
     * debug configuration information.
     */
    resolveDebugConfiguration(_folder : vscode.WorkspaceFolder | undefined, config : vscode.DebugConfiguration, _token ?: vscode.CancellationToken) : vscode.ProviderResult<vscode.DebugConfiguration> {
        if (!config.type && !config.request && !config.name) {
            const editor = vscode.window.activeTextEditor
            if (editor && editor.document.languageId === 'flux') {
                let query = ''
                if (editor.selection.isEmpty) {
                    query = editor.document.getText()
                } else {
                    query = editor.document.getText(editor.selection)
                }
                if (!query) {
                    vscode.window.showErrorMessage('Could not find flux to execute')
                    return undefined
                }

                config.type = 'flux'
                config.name = 'Launch'
                config.request = 'launch'
                config.query = query
            }
        }
        return config
    }
}

export function activateDebug(context : vscode.ExtensionContext) : void {
    const provider = new FluxDebugConfigurationProvider()
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('flux', provider))

    const factory = new InlineDebugAdapterFactory(context)
    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('flux', factory))
}
