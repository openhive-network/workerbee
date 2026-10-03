# The image AIDEV runs this project's suites in (`environment.image` in
# .aidev/project.yaml). It is the image CI's npm jobs use (common-ci-configuration
# npm_projects template, EMSCRIPTEN_IMAGE_TAG 4.0.22-5): Node 22.21.1 through nvm,
# pnpm 10.0.0. Suites run with `--network none`, so everything an install and the
# Playwright suite need is in the image:
#   - a pnpm store filled from pnpm-lock.yaml (`pnpm fetch`);
#   - the Chromium build of the locked Playwright version (the base image carries
#     a newer one; CI's `pretest` downloads it on every run);
#   - the npm-common-config submodule at its pinned commit, in /opt, which
#     .aidev/pnpm-deps.sh copies into a checkout whose submodule isn't initialised
#     (.npmrc, pnpm-workspace.yaml and the tsconfig base are symlinks into it).
# Build and pin it with .aidev/runtime/build.sh; see .aidev/README.md.
FROM registry.gitlab.syncad.com/hive/common-ci-configuration/emsdk:4.0.22-5@sha256:38d4220f0612ee2fb0f740a182211992b53dfa6d88cc58af1833eb91c969aeb1

USER root
# CI's `nvm use $NODEJS_VERSION`, as PATH: the emsdk entrypoint would put emsdk's own
# Node first, so it is dropped.
ENTRYPOINT []
ENV PATH=/home/emscripten/.nvm/versions/node/v22.21.1/bin:/home/emscripten/.local/share/pnpm:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    HOME=/tmp \
    npm_config_store_dir=/opt/pnpm-store \
    PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
    HUSKY=0 \
    DO_NOT_TRACK=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false

COPY npm-common-config/ /opt/npm-common-config/
COPY fetch/ /tmp/pnpm-fetch/
RUN cd /tmp/pnpm-fetch \
    && node --version && pnpm --version \
    && pnpm fetch \
    && pnpm install --offline --frozen-lockfile --ignore-scripts \
    && node_modules/.bin/playwright install chromium \
    && cd / && rm -rf /tmp/pnpm-fetch \
    && chmod -R a+rwX /opt/pnpm-store /opt/pw-browsers /opt/npm-common-config
