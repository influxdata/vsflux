import { FileSystem } from "./File";
import { window, OutputChannel, commands, ExtensionContext } from "vscode";
import { chmodSync } from "fs";

const lspRepo = "https://github.com/influxdata/flux-lsp/releases/download/";

export class Executables {
  /**
   * the path of lsp executable
   */
  public static async getLSP(
    context: ExtensionContext,
    version: string
  ): Promise<string> {
    let lspPath = "flux-lsp";
    if (process.platform === "win32") {
      lspPath = lspPath + ".exe";
    }
    const globalStatePath = context.globalStoragePath;
    const lspPathExtension = globalStatePath + "/" + lspPath;

    let lspExe = await FileSystem.findExecutablePath(lspPath);
    let lspExe2 = await FileSystem.findExecutablePath(lspPathExtension);
    if (!lspExe && !lspExe2) {
      lspPath = lspPathExtension;
      if (!(await FileSystem.doesDirExist(globalStatePath))) {
        if (!(await FileSystem.createDir(globalStatePath))) {
          window.showErrorMessage("Unable to install language server");
          return "error";
        }
      }

      let installed = await this.promoteInstall(
        "flux language server",
        this.DownloadLSP,
        version,
        lspPath
      );
      if (!installed) {
        window.showErrorMessage("Unable to install language server");
        return "error";
      }
      commands.executeCommand("workbench.action.reloadWindow");
    } else if (lspExe2) {
      lspPath = lspPathExtension;
    }
    return lspPath;
  }

  private static async promoteInstall(
    tool: string,
    install: (v: string, p: string) => Promise<boolean>,
    version: string,
    lspPath: string
  ): Promise<boolean> {
    const option = { title: "Install" };
    try {
      let selection = await window.showInformationMessage(
        "You are missing the " + tool,
        option
      );
      if (selection !== option) {
        return false;
      }
      return await install(version, lspPath);
    } catch (error) {
      return false;
    }
  }

  private static async doDownloadLSP(
    outputChannel: OutputChannel,
    release: string,
    lspPath: string
  ): Promise<boolean> {
    let out = await FileSystem.downloadFile(release, lspPath);
    if (out) {
      chmodSync(lspPath, "0755");
      outputChannel.dispose();
      return true;
    }
    outputChannel.appendLine("error downloading " + release);
    return false;
  }

  private static async DownloadLSP(
    version: string,
    lspPath: string
  ): Promise<boolean> {
    let outputChannel = window.createOutputChannel("Influx tools installation");
    outputChannel.show(true);
    let cmd: string;
    switch (process.platform) {
      case "darwin":
        return Executables.doDownloadLSP(
          outputChannel,
          lspRepo + version + "/flux-lsp-macos",
          lspPath
        );
      case "linux":
        return Executables.doDownloadLSP(
          outputChannel,
          lspRepo + version + "/flux-lsp-linux",
          lspPath
        );
      case "win32":
        return Executables.doDownloadLSP(
          outputChannel,
          lspRepo + version + "/flux-lsp.exe",
          lspPath
        );
      default:
        window.showErrorMessage(
          "This is not a supported OS, please see https://github.com/influxdata/flux-lsp for debug mode"
        );
        break;
    }
    return false;
  }
}
