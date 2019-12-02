# VSFlux

[![VSCode](https://img.shields.io/visual-studio-marketplace/i/influxdata.flux)](https://marketplace.visualstudio.com/items?itemName=influxdata.flux)
[![LICENSE](https://img.shields.io/github/license/influxdata/vsflux.svg)](https://github.com/influxdata/vsflux/blob/master/LICENSE)
[![Slack Status](https://img.shields.io/badge/slack-join_chat-white.svg?logo=slack&style=social)](https://www.influxdata.com/slack)

A [Visual Studio Code](https://visualstudio.microsoft.com/) extension with support for the Flux language, with features like syntax highlighting, error messages and autocompletion.

## Installation

VSFlux can be installed through the [VSCode Marketplace](https://marketplace.visualstudio.com/vscode).

The extension can be also built from source for development purposes.

### Building in Debug Mode

VSCode has an extension development mode that can be used for developing and debugging the extension.

1. `cargo install --git https://github.com/influxdata/flux-lsp.git` to install the flux language server.
1. `git clone https://github.com/influxdata/vsflux`
1. `cd vsflux`
1. `code .` to open the project in VSCode

Press `F5` within the editor. This will open a new VSCode window titled `Extension Development Host`. From here, open any folder with flux code.

The `Extension Development Host` window can be reloaded with `cmd-r` to pick up new changes to the editor.

Additionally, breakpoints can be added to the extension and will be triggered if executed by the plugin running in `Extension Development Host`.

### Sideloading the Extension

The extension can be sideloaded to test it end to end, instead of running in debug mode.

1. `cargo install --git https://github.com/influxdata/flux-lsp.git` to install the flux language server (if not already done)
1. `git clone https://github.com/influxdata/vsflux` (if not already done)
1. `npm install -g vsce` to globally install the [extension manager CLI tool](https://github.com/microsoft/vscode-vsce)
1. `vsce package` to build the package. This will generate a file ending with `.vsix`
1. In the [command palette](https://code.visualstudio.com/docs/getstarted/userinterface#_command-palette), run `Extensions: Install from VSIX...` and choose the vsix file that you generated.
