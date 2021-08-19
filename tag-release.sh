#!/bin/bash

hub_installed=$(command -v hub)
if [[ ! $hub_installed ]]; then
	echo "Please install the hub command line tool before running this script."
	echo "https://github.com/github/hub"
	exit 1
fi

new_version=v$(grep -Eom 1 "([0-9]{1,}\.)+[0-9]{1,}" package.json)

git tag -a -s $new_version -m "Release $new_version"
git push origin master $new_version

previous_version=`git describe --abbrev=0 ${new_version}^`
commits=`git log --pretty=oneline ${previous_version}...${new_version} | awk '{$1="-"; print }'`
hub release create $new_version -m "Release $new_version

${commits}" -e
