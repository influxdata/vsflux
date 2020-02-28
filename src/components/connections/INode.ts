import { ExtensionContext, TreeItem } from 'vscode'

export interface INode {
  getTreeItem(context: ExtensionContext): Promise<TreeItem> | TreeItem;

  getChildren(): Promise<INode[]> | INode[];
}
