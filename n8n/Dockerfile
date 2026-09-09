# n8n with the Hive nodes already installed.
#
#   docker build -f n8n/Dockerfile -t hive-n8n .        # context is the repo root
#   docker run --rm -p 5678:5678 hive-n8n
#
# The context is the repository root because the nodes embed the WorkerBee
# library from ../src: this image and the checkout it was built from always agree
# on the observer surface, which a published-package dependency could not
# guarantee while the library and the nodes move together.
#
# Alpine is fine here even though the Python-era image needed glibc: nothing in
# this package is a compiled CPython extension, and @hiveio/wax ships portable
# WebAssembly.

ARG NODE_VERSION=22
ARG N8N_VERSION=2.36.5


# --------------------------------------------------------------- build stage
FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /build

# Dependency layer first: rebuilt only when the manifest changes.
#
# --ignore-scripts because n8n-workflow drags in isolated-vm, which node-gyp
# would compile from source (python3 + a toolchain, minutes of build time) for a
# dependency this package only ever reads *.d.ts from. esbuild still works: npm
# installs its platform binary as an optional dependency, not from a script.
COPY n8n/package.json n8n/package-lock.json ./n8n/
RUN cd n8n && npm ci --no-audit --no-fund --ignore-scripts

# Application layer: the nodes, plus the library sources they bundle.
COPY src ./src
COPY n8n ./n8n

RUN mkdir -p /packages && cd n8n && npm run build && npm pack --pack-destination /packages


# ------------------------------------------------------------- runtime stage
FROM n8nio/n8n:${N8N_VERSION}

ARG BUILD_DATE
ARG VCS_REF

LABEL org.opencontainers.image.title="hive-n8n" \
      org.opencontainers.image.description="n8n with the Hive blockchain nodes (WorkerBee) preinstalled" \
      org.opencontainers.image.source="https://gitlab.syncad.com/hive/workerbee" \
      org.opencontainers.image.documentation="https://gitlab.syncad.com/hive/workerbee/-/tree/develop/n8n" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}"

# n8n-workflow is a peer dependency: the nodes import NodeOperationError and
# NodeApiError from it at runtime, because n8n cannot classify an error that is
# neither. A package installed through n8n's UI gets it from npm, which resolves
# peers into ~/.n8n/nodes; this image copies instead of installing, so nothing
# would put it there.
#
# NODE_PATH rather than a link inside ~/.n8n/nodes, because that directory is a
# mounted volume *and* the working directory of n8n's own community-node
# installer: installing any other community node from the UI would prune a link
# npm sees as extraneous, and the Hive nodes would stop loading at the next
# restart. This resolves to the very copy n8n runs -- one set of error classes,
# so n8n's `instanceof` checks hold -- and it is CJS-only, which is all these
# nodes need. The first entry is the base image's own value; keep it.
ENV NODE_PATH=/usr/local/lib/node_modules:/usr/local/lib/node_modules/n8n/node_modules

USER root

COPY --from=builder /packages/*.tgz /tmp/hive-nodes.tgz
COPY n8n/docker/entrypoint.sh /usr/local/bin/hive-nodes-entrypoint.sh

# Staged under /opt with its own node_modules, so `@hiveio/wax` resolves the
# ordinary way from the compiled node files -- no NODE_PATH, no hoisting
# assumptions. The entrypoint copies it into the user folder on start; see the
# comment there for why it is not simply installed in place.
#
# --omit=peer matters. npm installs peer dependencies by default, which would
# vendor a second n8n-workflow -- a different version from the one this very
# image runs, dragging in isolated-vm and 20 MB of transitive weight. Worse than
# the size: two copies mean two sets of error classes, and n8n's `instanceof`
# check against a NodeApiError from the wrong copy is false, which is precisely
# the classification this package throws them for. NODE_PATH above supplies the
# one true copy.
#
# Note for anyone tempted by N8N_CUSTOM_EXTENSIONS instead: that loader globs
# **/*.node.js under the directory it is given, which happily matches
# @hiveio/wax's own build_wasm/wax.node.js and then fails to load it as an n8n
# node. The community-package layout is keyed off package.json and does not glob.
RUN mkdir -p /opt/hive-nodes \
    && cd /opt/hive-nodes \
    && npm init -y > /dev/null \
    && npm install --omit=dev --omit=peer --no-audit --no-fund /tmp/hive-nodes.tgz \
    && sha256sum /tmp/hive-nodes.tgz | cut -d' ' -f1 > /opt/hive-nodes/.build-id \
    && rm /tmp/hive-nodes.tgz \
    && chmod +x /usr/local/bin/hive-nodes-entrypoint.sh \
    && chown -R node:node /opt/hive-nodes

USER node

ENV N8N_PORT=5678
EXPOSE 5678

ENTRYPOINT ["tini", "--", "/usr/local/bin/hive-nodes-entrypoint.sh"]
