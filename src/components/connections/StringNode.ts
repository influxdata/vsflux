import { INode } from './INode'

import {
	TreeItem,
	TreeItemCollapsibleState
} from 'vscode'

export class StringNode implements INode {
	constructor(private readonly value : string) { }

	public getTreeItem() : TreeItem {
		return {
			label: this.value,
			contextValue: this.value,
			collapsibleState: TreeItemCollapsibleState.None
		}
	}

	public getChildren() : INode[] {
		return []
	}
}
