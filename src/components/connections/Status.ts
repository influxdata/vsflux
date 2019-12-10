import { InfluxDBConnection } from "./Connection";
import { StatusBarItem, window, StatusBarAlignment } from "vscode";

export class Status {
  private static _current: InfluxDBConnection;
  private static _influxdbStatusBarItem: StatusBarItem;

  static get Current(): InfluxDBConnection {
    return Status._current;
  }

  private static getStatusBarItemText(conn: InfluxDBConnection): string {
    return `$(server) ${conn.name}`;
  }

  static set Current(conn: InfluxDBConnection) {
    this._current = conn;
    if (Status._influxdbStatusBarItem) {
      Status._influxdbStatusBarItem.text = Status.getStatusBarItemText(conn);
    } else {
      Status._influxdbStatusBarItem = window.createStatusBarItem(
        StatusBarAlignment.Left
      );
      Status._influxdbStatusBarItem.text = Status.getStatusBarItemText(conn);
      Status._influxdbStatusBarItem.show();
    }
  }
}
