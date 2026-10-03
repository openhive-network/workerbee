# Sourced by the .aidev suite scripts: make node_modules match pnpm-lock.yaml,
# offline, from the image's store. A marker records the lockfile and Node it was
# installed for; it is written only after an install that succeeded, and an
# install whose tools don't resolve is redone.
#
# .npmrc, pnpm-workspace.yaml and tsconfig's base are symlinks into the
# npm-common-config submodule. A checkout without the submodule gets the image's
# copy (/opt/npm-common-config, the commit the image was built from); git ignores
# files in an uninitialised submodule's directory.
if [ ! -e npm-common-config/pnpm-config/pnpm-workspace.yaml ]; then
    if [ -d /opt/npm-common-config/pnpm-config ]; then
        echo "npm-common-config submodule is not checked out: using the image's copy" >&2
        mkdir -p npm-common-config && cp -a /opt/npm-common-config/. npm-common-config/ || return 1
    else
        echo "npm-common-config submodule is not checked out (git submodule update --init npm-common-config)" >&2
        return 1
    fi
fi
lock_id="$(sha256sum pnpm-lock.yaml | cut -d' ' -f1) $(node --version)"
marker=node_modules/.aidev-pnpm-lock
if [ "$(cat "$marker" 2>/dev/null)" != "$lock_id" ] || [ ! -x node_modules/.bin/playwright ] || [ ! -x node_modules/.bin/tsc ]; then
    echo "node_modules is not current for pnpm-lock.yaml: pnpm install --offline" >&2
    pnpm install --offline --frozen-lockfile < /dev/null || return 1
    [ -x node_modules/.bin/playwright ] && [ -x node_modules/.bin/tsc ] || { echo "pnpm install left no playwright/tsc" >&2; return 1; }
    printf '%s\n' "$lock_id" > "$marker.tmp" && mv "$marker.tmp" "$marker"
fi
