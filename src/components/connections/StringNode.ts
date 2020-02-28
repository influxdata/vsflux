import { INode } from './INode'

import {
  ExtensionContext,
  TreeItem,
  TreeItemCollapsibleState
} from 'vscode'

export class StringNode implements INode {
  constructor (private readonly value: string) {}

  public getTreeItem (_: ExtensionContext): TreeItem {
    return {
      label: this.value,
      contextValue: this.value,
      collapsibleState: TreeItemCollapsibleState.None
    }
  }

  public getChildren (): INode[] {
    return []
  }
}
