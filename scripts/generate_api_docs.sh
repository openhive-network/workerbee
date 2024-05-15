#!/bin/bash

set -e

SCRIPTPATH="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
PROJECT_DIR="${SCRIPTPATH}/.."

# When using TypeScript, we are restricted to a specific typedoc and typedoc-plugin-markdown versions
# https://typedoc.org/guides/installation/#requirements
pushd "${PROJECT_DIR}"
mkdir -vp dist/docs
pnpm exec typedoc --readme README.md --out dist/docs --plugin typedoc-plugin-markdown --plugin typedoc-gitlab-wiki-theme --tsconfig tsconfig.json src/node.ts
popd
