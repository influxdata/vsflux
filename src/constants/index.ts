import { URL } from "url"

const lsVersion = "0.0.2"
const baseURL = `https://github.com/influxdata/flux-lsp/releases/download/${lsVersion}`

export const lspMacURL = `${baseURL}/flux-lsp-macos`
export const lspLinuxURL = `${baseURL}/flux-lsp-linux`
export const lspWindowsURL = `${baseURL}/flux-lsp.exe`