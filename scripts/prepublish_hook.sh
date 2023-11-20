#!/bin/bash

set -e

git config --global --add safe.directory '*'

git fetch --tags
REV_HASH=$(git rev-parse HEAD)
sed -i "s/\${CommitSHA}/${REV_HASH}/g" README.md
