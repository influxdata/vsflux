#!/bin/bash

hub_installed=$(command -v hub)
if [[ ! $hub_installed ]]; then
	echo "Please install the hub command line tool before running this script."
	echo "https://github.com/github/hub"
	exit 1
fi

current_branch=$(git branch --show-current)
if [[ $current_branch != "master" ]]; then
	echo "This script should only be run from the master branch. Aborting."
	exit 1
fi

git_changes=$(git status -s | wc -l)
if [[ $git_changes != 0 ]]; then
	echo "The master branch has been modified."
	echo "Please revert the changes or move them to another branch before running this script."
	exit 1
fi

git fetch
ahead=$(git status -sb | grep ahead -c)
if [[ $ahead != 0 ]]; then
	echo "Your local master branch is ahead of the remote master branch. Aborting."
	exit 1
fi

new_version=v$(grep -Eom 1 "([0-9]{1,}\.)+[0-9]{1,}" package.json)

git tag -a -s $new_version -m "Release $new_verion"
git push origin master $new_version

lsp_version=v$(grep -E -m 1 '"@influxdata/flux-lsp-node":' package.json | grep -Eo "([0-9]{1,}\.)+[0-9]{1,}")

hub release create $new_version -m "Release $new_version

- Upgrade to [Flux LSP $lsp_version](https://github.com/influxdata/flux-lsp/releases/tag/$lsp_version)" -e
