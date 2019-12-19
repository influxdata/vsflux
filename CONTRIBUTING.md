# Contributing to this Extension

For feature requests or questions on how to use this extension, visit the #flux channel in our [community slack](https://www.influxdata.com/slack).

## Bug Reports

Before filing an issue, please ensure that you are running the most recent version of the extension and then search existing issues to see if the problem has already been reported.

If the issue does not already exist, create an issue that includes instructions on how to reproduce the bug.

## Contributing to the Source Code

### Signing the CLA
In order to contribute to this project, you must sign the
[InfluxData Contributor License Agreement](https://www.influxdata.com/legal/cla/) (CLA).

### Building in Debug Mode

VSCode has an extension development mode that can be used for developing and debugging the extension.

1. `git clone https://github.com/influxdata/vsflux`
1. `cd vsflux`
1. `npm install` to install dependencies
1. `code .` to open the project in VSCode

Press `F5` within the editor. This will open a new VSCode window titled `Extension Development Host`. From here, open any folder with flux code.

The `Extension Development Host` window can be reloaded with `cmd-r` to pick up new changes to the editor.

Additionally, breakpoints can be added to the extension and will be triggered if executed by the plugin running in `Extension Development Host`.

### Sideloading the Extension

The extension can be sideloaded to test it end to end, instead of running in debug mode.

1. `git clone https://github.com/influxdata/vsflux` (if not already done)
1. `npm install` to install dependencies
1. `npm install -g vsce` to globally install the [extension manager CLI tool](https://github.com/microsoft/vscode-vsce)
1. `vsce package` to build the package. This will generate a file ending with `.vsix`
1. In the [command palette](https://code.visualstudio.com/docs/getstarted/userinterface#_command-palette), run `Extensions: Install from VSIX...` and choose the vsix file that you generated.