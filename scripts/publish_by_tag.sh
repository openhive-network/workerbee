#!/bin/bash

# This script is intended to download artifacts from the latest pipeline with
# job named "build" from given GitLab project, and then publish it to npm with provenance
#
# Example usage for project WorkerBee:
#
# ./scripts/publish_by_tag.sh 452 1.27.6-rc5 "dist/hiveio-workerbee-1.27.6-rc5.tgz" build dist

set -e

PROJECT_ID=${1:?Missing arg \#1 - GitLab project id}
TAG=${2:?Missing arg \#2 - TAG name}
TGZ_PATH=${3:?Missing arg \#3 - TGZ Artifacts filepath}
JOB_NAME=${4:?Missing arg \#4 - Job name containing the tgz artifacts}
OUTPUT_DIR=${5:?Missing arg \#5 - Output directory}

API_PREFIX="https://gitlab.syncad.com/api/v4/projects/${PROJECT_ID}"

CHECK_REPO_EXISTANCE_ERROR_MSG=$(curl -s "${API_PREFIX}" | jq -r ".message")

if [ "${CHECK_REPO_EXISTANCE_ERROR_MSG}" != "null" ]; then
  echo "Error fetching source repository. Cause: \"${CHECK_REPO_EXISTANCE_ERROR_MSG}\""
  exit 1
fi

TGZ_PULL_URL="${API_PREFIX}/jobs/artifacts/${TAG}/raw/${TGZ_PATH}?job=build"

TARGET_FILEPATH=/tmp/$(basename "${TGZ_PATH}")

echo "Downloading artifact from \"${TGZ_PULL_URL}\" to \"${TARGET_FILEPATH}\""

curl -o "${TARGET_FILEPATH}" "${TGZ_PULL_URL}"

mkdir -vp "${OUTPUT_DIR}"

echo "Unpacking artifact to \"${OUTPUT_DIR}\""

tar -xvf "${TARGET_FILEPATH}" --strip-components=1 -C "${OUTPUT_DIR}"

