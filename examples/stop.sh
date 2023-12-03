#! /bin/bash
set -e

SCRIPTPATH="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"

pushd "${SCRIPTPATH}"
docker compose down -v --remove-orphans
popd