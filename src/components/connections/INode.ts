import { ExtensionContext, TreeItem, OutputChannel } from 'vscode'

export interface INode {
  getTreeItem(context: ExtensionContext): Promise<TreeItem> | TreeItem;

  getChildren(outputChannel?: OutputChannel): Promise<INode[]> | INode[];
}
