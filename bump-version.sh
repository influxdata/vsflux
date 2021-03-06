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

release_type=$1
if [[ $release_type != "patch" && $release_type != "minor" ]]; then
	echo "Invalid argument: $release_type"
	exit 1
fi

version=v$(cat package.json| grep -Po -m 1 '\d+\.\d+\.\d+')
npm version $release_type --no-git-tag-version
npm install
new_version=v$(cat package.json | grep -Po -m 1 '\d+\.\d+\.\d+')

branch_name=bump-$new_version

git checkout -B $branch_name
echo "Checking out branch \`$branch_name\`"

echo "Incrementing version"
echo "$version -> $new_version"

git commit -am "build: Release $new_version"
npm add @influxdata/flux-lsp-node
git commit -am "build: Import latest version of flux-lsp-node"
git push -u origin $branch_name

hub pull-request -o \
	-m "build: Release $new_version" \
	-m "- Change version from $version to $new_version
- Import latest version of flux-lsp-node
" &> /dev/null &
