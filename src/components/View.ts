import { ExtensionContext } from 'vscode'
import fs = require('fs');

export abstract class View {
    protected template : string;
    private path : string;
    protected context : ExtensionContext;

    public constructor(context : ExtensionContext, templatePath : string) {
        this.context = context
        this.path = this.context.asAbsolutePath(templatePath)
        this.template = this.readTemplate()
    }

    private readTemplate() {
        return fs.readFileSync(this.path, { encoding: 'utf8' })
    }
}
