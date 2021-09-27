#!/bin/bash

# This script will check the state of the main branch of vsflux for
# conditions that would allow for a release to occur. If those conditions
# are met, a signed tag is created and *pushed to github* where the CI
# will take over and publish the extension.

if [[ ! $(command -v hub) ]]; then
	echo "Please install the hub tool and re-run."
	exit 1
fi

if [[ ! $(command -v jq) ]]; then
	echo "Please install the jq tool and re-run."
	exit 1
fi

if [[ ! -z $(git status -s) ]]; then
    echo "Working tree not clean. Please re-run when the tree is clean."
    exit
fi

local_rev=`git rev-parse HEAD`
remote_rev=`curl -s https://api.github.com/repos/influxdata/vsflux/commits/master | jq -r .sha`
if [[ $local_rev != $remote_rev ]]; then
    echo "Local HEAD $local_rev is not the same as remote rev $remote_rev"
    exit
fi

npm add @influxdata/flux-lsp-node
if [[ ! -z $(git status -s) ]]; then
    echo "Please upgrade flux-lsp-node to the latest version prior to release."
    exit
fi

new_version=`npm version patch --sign-git-tag`
remote=`git remote -v | grep "influxdata/vsflux.git (push)$" | awk '{print $1}'`
git push $remote $new_version

previous_version=`git describe --abbrev=0 ${new_version}^`
commits=`git log --pretty=oneline ${previous_version}...${new_version} | tail -n +2 | awk '{$1="-"; print }'`
hub release create $new_version -m "Release $new_version

${commits}"

echo "$new_version tagged and released"
