import { ExtensionContext, TreeItem } from 'vscode'

export interface INode {
  getTreeItem(): Promise<TreeItem> | TreeItem;

  getChildren(): Promise<INode[]> | INode[];
}
