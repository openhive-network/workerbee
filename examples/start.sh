#! /bin/bash
set -e

SCRIPTPATH="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"

# Node for Dockerfile.npm: common-ci-configuration's NODE_VERSION, as its CI passes it
# (NODE_IMAGE_VERSION, without the "v"); export NODE_VERSION to override.
if [ -z "${NODE_VERSION:-}" ]; then
  NODE_VERSION="$(sed -n '/^variable "NODE_VERSION"/,/}/s/.*default *= *"v\{0,1\}\([^"]*\)".*/\1/p' \
    "${SCRIPTPATH}/../npm-common-config/docker-bake.hcl")"
  export NODE_VERSION="${NODE_VERSION:?cannot read NODE_VERSION from npm-common-config/docker-bake.hcl; run git submodule update --init npm-common-config}"
fi

pushd "${SCRIPTPATH}"
docker compose up --remove-orphans --force-recreate $@
popd
