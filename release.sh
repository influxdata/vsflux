#!/bin/bash

# This script will check the state of the main branch of vsflux for
# conditions that would allow for a release to occur. If those conditions
# are met, a signed tag is created and *pushed to github* where the CI
# will take over and publish the extension.
set -e

if [[ ! $(command -v hub) ]]; then
	echo "Please install the hub tool and re-run."
	exit 1
fi

if [[ ! $(command -v jq) ]]; then
	echo "Please install the jq tool and re-run."
	exit 1
fi

TEMPDIR=$(mktemp -d -t flux-release.XXXX)
echo "Using fresh install in $TEMPDIR"
cd $TEMPDIR
git clone git@github.com:influxdata/vsflux.git > /dev/null 2>&1
cd $TEMPDIR/vsflux

# `npm outdated` only works with everything installed.
npm i
if [[ $(npm outdated @influxdata/flux-lsp-node) ]]; then
	echo "flux-lsp can be upgraded. Please upgrade to `npm outdated @influxdata/flux-lsp-node | tail -n 1 | awk '{print $4}'` before release."
	exit 1
fi

if [[ ! $(hub ci-status HEAD) ]]; then
	echo "Build status on master is either incomplete or failing. Please try again after build status is complete."
	exit 1
fi

new_version=`npm version patch --sign-git-tag`
git push

previous_version=`git tag --sort=-creatordate | sed -n '2 p'`
commits=`git log --pretty=oneline ${previous_version}..${new_version} | tail -n +2 | awk '{$1="-"; print }'`
hub release create $new_version -m "Release $new_version

${commits}"
echo "$new_version tagged and released"

rm -rf $TEMPDIR