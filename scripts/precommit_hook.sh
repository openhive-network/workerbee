#!/bin/bash

set -e

SCRIPTPATH="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
PROJECT_DIR="${SCRIPTPATH}/.."

STAGED_FILES=($(git diff --name-only --cached))

if [[ " ${STAGED_FILES[*]} " =~ " README.md " ]];
then
  (grep "\${CommitSHA}" README.md 1>/dev/null) || (echo "Commit sha placeholder in README.md is broken - preventing commit." && exit 4)
fi
