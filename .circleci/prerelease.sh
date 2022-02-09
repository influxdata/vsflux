#!/bin/sh

# Release a prerelease version of vsflux. This patch will get the current tagged version,
# i.e. the one that is committed in tree, increment the last version digit to get the upcoming
# version. It then counts the number of commits that have occurred since last release and adds
# that as the prerelease version. For example, for version 1.0.0, if the new commit is three
# commits past the v1.0.0 tag, the version will be set to v1.0.1-3. This version
# _will not be committed_, to prevent the class of issues that can arise when a CI
# infrastructure can commit changes.

PARENT=`dirname $0`
cd ${PARENT}/..
CURRENT_VERSION=`jq -r .version package.json`
COUNT=`git log v${CURRENT_VERSION}..HEAD --oneline | wc -l | xargs`
UPCOMING_VERSION_BUMP=$(( ${CURRENT_VERSION##*.} + 1 ))
VERSION=${CURRENT_VERSION%.*}.${UPCOMING_VERSION_BUMP}-${COUNT} # Replace the last set of numbers with the count

echo "Bumping version to ${VERSION}"
npm version ${VERSION} --no-git-tag-version
npm run prerelease