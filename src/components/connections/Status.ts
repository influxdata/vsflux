import { InfluxDBConnection } from './Connection'
import { StatusBarItem, window, StatusBarAlignment } from 'vscode'
import { CancelTokenSource } from 'axios'

export class Status {
  private static current?: InfluxDBConnection;
  private static statusBarItem: StatusBarItem;
  private static cancelTokenSource?: CancelTokenSource;

  static get CancelTokenSource () {
    return Status.cancelTokenSource
  }

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

  static SetRunningQuery (source: CancelTokenSource) {
    this.cancelTokenSource = source
    this.statusBarItem.text = '$(chrome-close) cancel query'
    this.statusBarItem.command = 'influxdb.cancelQuery'
    this.statusBarItem.show()
  }

  static SetNotRunnningQuery () {
    this.cancelTokenSource = undefined
    this.statusBarItem.text = Status.currentStatusBarText
    this.statusBarItem.command = ''
    this.statusBarItem.show()
  }
}
