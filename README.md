> [!IMPORTANT]
> This plugin is no longer maintained and will be removed. The [Flux](https://github.com/influxdata/flux) language is no longer actively developed and is in maintenance mode.

# Flux

[![VSCode](https://img.shields.io/visual-studio-marketplace/i/influxdata.flux)](https://marketplace.visualstudio.com/items?itemName=influxdata.flux)
[![LICENSE](https://img.shields.io/github/license/influxdata/vsflux.svg)](https://github.com/influxdata/vsflux/blob/master/LICENSE)
[![Slack Status](https://img.shields.io/badge/slack-join_chat-white.svg?logo=slack&style=social)](https://www.influxdata.com/slack)

A [Visual Studio Code](https://visualstudio.microsoft.com/) extension with support for the working with InfluxDB instances.

Features:
* Flux language support
  * Syntax highlighting
  * Autocompletion
  * Error highlighting
  * Find references
  * Go to definition
  * Function signatures
  * Code folding
  * Symbol renaming
  * Document symbols
* InfluxDB server 
  * Add/edit/delete buckets
  * Inspect bucket measurements and tags
  * Add/edit/delete tasks (2.x series only)
  * Run flux scripts natively and show results
  * Environment-specific autocompletion (bucket names, etc)

## Installation

The extension can be installed through the [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=influxdata.flux).

### Using the cli configurations

Rather than using vscode to store information about influxdb instances fro the InfluxDB pane, vsflux can use existing `influx` cli configurations to populate the InfluxDB pane of connections. To do this, edit `%APP_DATA%/settings.json` to add the following:

    {
      "vsflux.datasource": "cli"
    }

To revert this setting, change `"cli"` to `"db"` or remove the line entirely.

## Contributing

Contribution guidelines and instructions on how to build from source can be found in the [Contributing Guide](https://github.com/influxdata/vsflux/blob/master/CONTRIBUTING.md).
