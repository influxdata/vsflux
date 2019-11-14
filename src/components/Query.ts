import * as vscode from "vscode";
import * as child from "child_process";
import { InfluxDBConnection } from "./Connection";

export class InfluxCli {
  private _path: string;
  private _outputChannel: vscode.OutputChannel;

  public constructor(
    influxCliPath: string,
    outputChannel: vscode.OutputChannel
  ) {
    this._path = influxCliPath;
    this._outputChannel = outputChannel;
  }

  public async Run(iConn: InfluxDBConnection, query?: string) {
    const activeTextEditor = vscode.window.activeTextEditor;

    if (!query && !activeTextEditor) {
      vscode.window.showWarningMessage("No Flux file selected");
      return;
    } else if (!query && activeTextEditor) {
      const selection = activeTextEditor.selection;
      if (selection.isEmpty) {
        query = activeTextEditor.document.getText();
      } else {
        query = activeTextEditor.document.getText(selection);
      }
    }

    if (!iConn) {
      vscode.window.showWarningMessage("No influxDB Server selected");
    }
    let cmd: string =
      this._path +
      " query '" +
      query +
      "' -o " +
      iConn.org +
      " --host " +
      iConn.hostNport +
      " --token " +
      iConn.token;
    this._outputChannel.append("Running Query: '" + query + "'\n\r");
    child.exec(cmd, (err, stdout, stderr) => {
      let out: string = stdout.toString();
      if (stderr) {
        out = stderr.toString();
      }
      this._outputChannel.append(stdout.toString());
      if (err) {
        vscode.window.showWarningMessage(err.message);
      }
    });
  }
}
