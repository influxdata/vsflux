#!/bin/bash

hub_installed=$(command -v hub)
if [[ ! $hub_installed ]]; then
	echo "Please install the hub command line tool before running this script."
	echo "https://github.com/github/hub"
	exit 1
fi

new_version=v$(grep -Eom 1 "([0-9]{1,}\.)+[0-9]{1,}" package.json)

git tag -a -s $new_version -m "Release $new_verion"
git push origin master $new_version

lsp_version=v$(grep -m 1 '"@influxdata/flux-lsp-node":' package.json | grep -Eo "([0-9]{1,}\.)+[0-9]{1,}")

hub release create $new_version -m "Release $new_version

- Upgrade to [Flux LSP $lsp_version](https://github.com/influxdata/flux-lsp/releases/tag/$lsp_version)" -e
