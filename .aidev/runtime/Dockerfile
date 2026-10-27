# The image AIDEV runs this project's suites in (`environment.image` in
# .aidev/project.yaml). It builds on common-ci-configuration's node-test-tools at its
# moving `develop` tag, so Node and pnpm are the versions ccc's docker-bake.hcl
# defines; this repository pins neither. Suites run with `--network none`, so
# everything an install and the Playwright suite need is in the image:
#   - a pnpm store filled from pnpm-lock.yaml (`pnpm fetch`);
#   - the Chromium build of the locked Playwright version, in /opt (the base image
#     has its system dependencies; CI's `pretest` runs `playwright install chromium`);
#   - the npm-common-config submodule at its pinned commit, in /opt, which
#     .aidev/pnpm-deps.sh copies into a checkout whose submodule isn't initialised
#     (.npmrc, pnpm-workspace.yaml and the tsconfig base are symlinks into it).
# Build and pin it with .aidev/runtime/build.sh; see .aidev/README.md.
FROM registry.gitlab.syncad.com/hive/common-ci-configuration/node-test-tools:develop

USER root
ENV HOME=/tmp \
    npm_config_store_dir=/opt/pnpm-store \
    PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
    HUSKY=0 \
    DO_NOT_TRACK=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false

COPY npm-common-config/ /opt/npm-common-config/
COPY fetch/ /tmp/pnpm-fetch/
# Three layers (the pnpm store, Chromium's headless shell, Chromium): as one layer it
# is too big to push before a registry upload times out. Each later layer installs a
# throwaway node_modules by copying, as hardlinks would bring the store files into it.
RUN cd /tmp/pnpm-fetch \
    && node --version && pnpm --version \
    && pnpm fetch \
    && chmod -R a+rwX /opt/pnpm-store /opt/npm-common-config
RUN cd /tmp/pnpm-fetch \
    && pnpm install --offline --frozen-lockfile --ignore-scripts --package-import-method=copy \
    && node_modules/.bin/playwright install --only-shell chromium \
    && rm -rf node_modules \
    && chmod -R a+rwX /opt/pw-browsers
RUN cd /tmp/pnpm-fetch \
    && pnpm install --offline --frozen-lockfile --ignore-scripts --package-import-method=copy \
    && node_modules/.bin/playwright install --no-shell chromium \
    && cd / && rm -rf /tmp/pnpm-fetch \
    && find /opt/pw-browsers ! -perm -a+rw -exec chmod a+rwX {} +
