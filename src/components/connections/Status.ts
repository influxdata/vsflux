import { InfluxDBConnection } from './Connection'
import { StatusBarItem, window, StatusBarAlignment } from 'vscode'

export class Status {
  private static current?: InfluxDBConnection;
  private static statusBarItem: StatusBarItem;

  static get Current () {
    return Status.current
  }

  private static get currentStatusBarText (): string {
    if (!this.Current) {
      return ''
    }

    return `$(server) ${this.Current.name}`
  }

  private static set statusBarText (val: string) {
    if (!this.statusBarItem) {
      this.statusBarItem = window.createStatusBarItem(
        StatusBarAlignment.Left
      )
    }

    this.statusBarItem.text = val
  }

  static set Current (conn: InfluxDBConnection | undefined) {
    this.current = conn
    this.statusBarText = Status.currentStatusBarText
    this.statusBarItem.show()
  }
}
