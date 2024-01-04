#!/bin/bash

set -e

SCRIPTPATH="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
PROJECT_DIR="${SCRIPTPATH}/.."

# When using TypeScript, we are restricted to a specific typedoc and typedoc-plugin-markdown versions
# https://typedoc.org/guides/installation/#requirements
pushd "${PROJECT_DIR}"
mkdir -vp dist/docs
pnpm exec typedoc --plugin typedoc-plugin-markdown --theme markdown --excludeInternal --hideBreadcrumbs --hideInPageTOC --out dist/docs src/web.ts
mv dist/docs/modules.md dist/docs/_modules.md
rm dist/docs/README.md
pnpm exec concat-md --decrease-title-levels dist/docs > api.md
popd
