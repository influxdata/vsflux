import { ExtensionContext } from "vscode";
import fs = require("fs");

export abstract class View {
  private template?: string;
  private path: string;
  protected context: ExtensionContext;

  public constructor(context: ExtensionContext, templatePath: string) {
    this.context = context;
    this.path = this.context.asAbsolutePath(templatePath);
  }

  protected async getTemplate(): Promise<string> {
    if (!this.template) {
      this.template = await this.readTemplate();
    }

    return this.template
  }

  private async readTemplate(): Promise<string> {
    return new Promise((resolve, reject) => {
      fs.readFile(this.path, {encoding: "utf8"}, (err, val) => {
        if (err) {
          return reject(err)
        }

        resolve(val);
      })
    })
  }
}
