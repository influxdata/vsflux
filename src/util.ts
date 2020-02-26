import * as vscode from 'vscode'

export const outputChannel = vscode.window.createOutputChannel('influxdb')

export function getConfig () {
  return vscode.workspace.getConfiguration('vsflux')
}

export function defaultV1URL (): string {
  return getConfig()?.get<string>('defaultInfluxDBV1URL', '')
}

export function defaultV2URLList (): string[] {
  return getConfig()?.get<string[]>('defaultInfluxDBURLs', [''])
}

export function pad (n: number) {
  return n < 10 ? '0' + n : n
}
export function timezoneOffset (offset: number): string {
  if (offset === 0) {
    return 'Z'
  }

  const sign = offset > 0 ? '-' : '+'
  offset = Math.abs(offset)
  const hours = pad(Math.floor(offset / 60))
  const minutes = pad(offset % 60)
  return `${sign}${hours}:${minutes}}`
}
export function now (): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = pad(d.getMonth() + 1)
  const day = pad(d.getDate())
  const hour = pad(d.getHours())
  const minutes = pad(d.getMinutes())
  const seconds = pad(d.getSeconds())
  const timezone = timezoneOffset(d.getTimezoneOffset())

  return `${year}-${month}-${day}T${hour}:${minutes}:${seconds}${timezone}}`
}
