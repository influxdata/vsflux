import { ExtensionContext } from "vscode";
import fs = require("fs");

export abstract class View {
  protected template: string;
  protected context: ExtensionContext;

  public constructor(context: ExtensionContext, templatePath: string) {
    this.context = context;
    this.template = String(
      fs.readFileSync(this.context.asAbsolutePath(templatePath))
    );
  }
}
