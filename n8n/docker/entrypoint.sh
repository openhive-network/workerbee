#!/bin/sh
# Publish the Hive nodes into n8n's user folder, then hand over to n8n's own
# entrypoint.
#
# The nodes are installed into the image at /opt/hive-nodes, complete with their
# node_modules, and copied here rather than installed here: the copy needs no
# network and no npm, so a container starts the same way on an air-gapped host.
#
# Why copy at all: n8n discovers community packages under $N8N_USER_FOLDER/.n8n/
# nodes, and that directory is also where every deployment mounts its data
# volume. A named volume is seeded from the image only the first time it is
# created, so nodes baked into the image would go stale the moment the image is
# upgraded. Syncing on each start keeps the image the source of truth for code
# and the volume the source of truth for data.
set -e

STAGED=/opt/hive-nodes
NODES_DIR="${N8N_USER_FOLDER:-/home/node}/.n8n/nodes"

# Keyed on the build, not on the package version. During development the version
# rarely moves while the code does, and a version check would leave the volume
# serving the previous build after every rebuild -- silently, which is the worst
# way to lose an afternoon. The id is the hash of the packed tarball, so it
# changes whenever the package does.
staged_id=$(cat "${STAGED}/.build-id" 2>/dev/null || echo unknown)
installed_id=$(cat "${NODES_DIR}/.hive-build-id" 2>/dev/null || echo none)

mkdir -p "${NODES_DIR}/node_modules"

if [ "${staged_id}" != "${installed_id}" ]; then
  version=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "${STAGED}/node_modules/@hiveio/n8n-nodes-hive/package.json" | head -n 1)
  echo "Installing @hiveio/n8n-nodes-hive ${version} (build ${staged_id}) into ${NODES_DIR}; previous build: ${installed_id}"
  rm -rf "${NODES_DIR}/node_modules/@hiveio/n8n-nodes-hive"
  cp -a "${STAGED}/package.json" "${NODES_DIR}/package.json"
  cp -a "${STAGED}/node_modules/." "${NODES_DIR}/node_modules/"
  echo "${staged_id}" > "${NODES_DIR}/.hive-build-id"
fi

# n8n-workflow reaches the nodes through NODE_PATH, set in the Dockerfile -- see
# the comment there for why not a link in this directory. Assert it rather than
# assume it: without it both nodes fail to load, n8n still reports healthy, and
# every saved Hive workflow silently stops activating. Better to not boot.
rm -rf "${NODES_DIR}/node_modules/n8n-workflow"   # planted by an earlier image
if ! node -e 'require.resolve("n8n-workflow")' 2>/dev/null; then
  echo "FATAL: n8n-workflow is not resolvable; the Hive nodes cannot load." >&2
  echo "       NODE_PATH=${NODE_PATH:-unset}" >&2
  exit 1
fi

exec /docker-entrypoint.sh "$@"
