import { INode } from "./INode";

import {
  ExtensionContext,
  TreeItem,
  TreeItemCollapsibleState,
  OutputChannel
} from "vscode";
import { InfluxDBConnection } from "./Connection";

export class StringNode implements INode {
  constructor(private readonly value: string) {}

  public getTreeItem(_: ExtensionContext): TreeItem {
    return {
      label: this.value,
      contextValue: this.value,
      collapsibleState: TreeItemCollapsibleState.None
    };
  }
  public getChildren(_outputChannel: OutputChannel): INode[] {
    return [];
  }
}
