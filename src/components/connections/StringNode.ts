import { INode } from "./INode";

import {
  ExtensionContext,
  TreeItem,
  TreeItemCollapsibleState,
  OutputChannel
} from "vscode";
import { InfluxDBConnection } from "./Connection";

export function NewStringNode(
  v: string,
  _a: OutputChannel,
  _b: InfluxDBConnection
): StringNode {
  return new StringNode(v);
}

class StringNode implements INode {
  constructor(private readonly v: string) {}

  public getTreeItem(_: ExtensionContext): TreeItem {
    return {
      label: this.v,
      contextValue: this.v,
      collapsibleState: TreeItemCollapsibleState.None
    };
  }
  public getChildren(_outputChannel: OutputChannel): INode[] {
    return [];
  }
}
