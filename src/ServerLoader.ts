// ServerLoader is responsible for downloading the language server.

import {lspMacURL, lspLinuxURL, lspWindowsURL} from './constants';
import * as http from 'http';
import * as fs from 'fs';
import * as vscode from "vscode";
import { URL } from 'url';

export class ServerLoader {
    private storage: fs.PathLike;

    constructor(context: vscode.ExtensionContext) {
        this.storage = context.globalStoragePath
    }

    async download(): Promise<void> {
        if (!this.downloadPath()) {
            vscode.window.showErrorMessage("unsupported operating system; unable to fetch language server")
            return
        }

        // per docs, storage isn't guaranteed to exist
        if (!fs.existsSync(this.storage)) {
            fs.mkdirSync(this.storage)
        }

        const dest = `${this.storage}/flux-lsp`

        // check if file already exists
        if (fs.existsSync(dest)) {
            return
        }

        let ws = fs.createWriteStream(dest)

        var request = http.get(this.downloadPath(), (response) => {
            response.pipe(ws);
            ws.on('finish', function() {
              ws.close();
            });
          }).on('error', function(err) { // Handle errors
            fs.unlinkSync(dest);
            vscode.window.showErrorMessage("failed to download language server")
          });
    
        fs.chmodSync(dest, 777)
    }

    private downloadPath(): string {
        switch (process.platform) {
            case "darwin":
                return lspMacURL
            case "linux":
                return lspLinuxURL
            case "win32":
                return lspWindowsURL
            default:
                return ""
            break;
        }
    }
}