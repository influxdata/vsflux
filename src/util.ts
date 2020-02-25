import * as vscode from "vscode";

export const outputChannel = vscode.window.createOutputChannel("influxdb")

export function getConfig() {
  return vscode.workspace.getConfiguration("vsflux");
}

export function defaultV1URL(): string {
  return getConfig()?.get<string>("defaultInfluxDBV1URL", "");
}

export function defaultV2URL(): string {
  return getConfig()?.get<string>("defaultInfluxDBURL", "");
}

export function pad(n: number) {
  return n < 10 ? "0" + n : n;
}

export function timezoneOffset(offset: number): string {
  var sign;
  if (offset === 0) {
    return "Z";
  }

  sign = offset > 0 ? "-" : "+";
  offset = Math.abs(offset);
  var hh = pad(Math.floor(offset / 60));
  var mm = pad(offset % 60);
  return `${sign}${hh}:${mm}`;
}

export function now(): string {
  var d = new Date();
  let year = d.getFullYear();
  let month = pad(d.getMonth() + 1);
  let day = pad(d.getDate());
  let hour = pad(d.getHours());
  let minutes = pad(d.getMinutes());
  let seconds = pad(d.getSeconds());
  let timezone = timezoneOffset(d.getTimezoneOffset());
  return `${year}-${month}-${day}T${hour}:${minutes}:${seconds}${timezone}`;
}