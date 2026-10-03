#!/usr/bin/env bash
# Build (and with --push, publish) the test runtime image of .aidev/runtime/Dockerfile
# and print the digest-pinned reference to put in .aidev/project.yaml's
# `environment.image`. See .aidev/README.md.
#
# The tag is `aidev-<hash>`, the hash of the image inputs (the Dockerfile,
# `packageManager` from package.json, pnpm-lock.yaml, the workspace's package.json
# files, and the npm-common-config submodule commit, which provides .npmrc and
# pnpm-workspace.yaml); the registry cleanup policy keeps `aidev-*` tags. When
# <repository>:aidev-<hash> is already in the registry nothing is built: the script
# prints that image's digest.
#
#   .aidev/runtime/build.sh           # registry digest, or build locally and print the local tag
#   .aidev/runtime/build.sh --push    # registry digest, or build + push and print repo@sha256:<digest>
#   .aidev/runtime/build.sh --tag     # print the input-hash tag only
#
# Needs the npm-common-config submodule checked out at the commit HEAD records
# (git submodule update --init npm-common-config).
set -euo pipefail

cd "$(dirname "$0")/../.."

REPOSITORY="${AIDEV_RUNTIME_REPOSITORY:-registry.gitlab.syncad.com/hive/workerbee/aidev-tests}"

submodule_commit() { git ls-tree HEAD npm-common-config | awk '{print $3}'; }

input_hash() {
    {
        sha256sum .aidev/runtime/Dockerfile pnpm-lock.yaml packages/blog-logic/package.json
        grep '"packageManager"' package.json
        echo "npm-common-config $(submodule_commit)"
    } | sha256sum | cut -c1-16
}
TAG="aidev-$(input_hash)"

case "${1:-}" in
    --tag) echo "$TAG"; exit 0 ;;
    ""|--push) ;;
    *) echo "usage: $0 [--push|--tag]" >&2; exit 2 ;;
esac

# Digest of <repository>:<tag> in the registry, empty when the tag doesn't exist.
registry_digest() {
    docker buildx imagetools inspect "$REPOSITORY:$TAG" --format '{{json .Manifest}}' 2>/dev/null \
        | grep -o '"digest": *"sha256:[0-9a-f]*"' | head -1 | grep -o 'sha256:[0-9a-f]*' || true
}

digest="$(registry_digest)"
if [ -n "$digest" ]; then
    echo "$REPOSITORY:$TAG exists in the registry; not building" >&2
    echo "$REPOSITORY@$digest"
    exit 0
fi
echo "$REPOSITORY:$TAG is not in the registry; building it" >&2

want="$(submodule_commit)"
have="$(git -C npm-common-config rev-parse HEAD 2>/dev/null || true)"
if [ "$have" != "$want" ]; then
    echo "npm-common-config is at '${have:-not checked out}', HEAD records $want:" \
         "git submodule update --init npm-common-config" >&2
    exit 1
fi

# Only the files the Dockerfile copies: the repository root holds node_modules.
# .npmrc and pnpm-workspace.yaml are symlinks into the submodule; copy their targets.
context="$(mktemp -d)"
trap 'rm -rf "$context"' EXIT
mkdir -p "$context/fetch/packages/blog-logic"
cp -L package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc "$context/fetch/"
cp packages/blog-logic/package.json "$context/fetch/packages/blog-logic/"
git -C npm-common-config archive --format=tar --prefix=npm-common-config/ HEAD | tar -x -C "$context"

# buildx so it works with any builder (CI's docker-container builder keeps no local
# image); no provenance, so the pushed digest is a plain image manifest.
build=(docker buildx build --pull --provenance=false -f .aidev/runtime/Dockerfile -t "$REPOSITORY:$TAG")
if [ "${1:-}" != "--push" ]; then
    "${build[@]}" --load "$context" >&2
    echo "$REPOSITORY:$TAG"
    exit 0
fi

"${build[@]}" --push --metadata-file "$context/metadata.json" "$context" >&2
digest="$(grep -o '"containerimage.digest": *"sha256:[0-9a-f]*"' "$context/metadata.json" | grep -o 'sha256:[0-9a-f]*')"
echo "$REPOSITORY@${digest:?no digest in buildx metadata}"
