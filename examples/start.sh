#! /bin/bash
set -e

SCRIPTPATH="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"

pushd "${SCRIPTPATH}"
docker compose up --remove-orphans --force-recreate $@
popd
