#!/usr/bin/env bash
# The checks AIDEV's verification slots run (.aidev/project.yaml), as junit under
# test-results/<suite>/: junit.xml has one case per step, playwright-junit.xml one
# case per Playwright test.
#
#   .aidev/run-checks.sh <suite> <step>...
#
#   lint        ESLint with --max-warnings 0 (package.json `lint-ci`)
#   typecheck   tsc --noEmit for the library and packages/blog-logic
#   build       package.json `build` without its `prebuild` (ls-engines, husky):
#               tsc, rollup, terser, size-limit; then the files package.json
#               `exports` / `types` point at must exist in dist/ (dist-exports)
#   docs        the API reference, as CI's `generate_docs` job (typedoc, markdown
#               plugins) into $out/docs
#   test        Playwright, project workerbee_testsuite (__tests__/index.spec.ts)
#   test-mock   Playwright, project workerbee_testsuite_mock (recorded API data)
#   test-all    both projects, as package.json `test` and CI's `test` job run them
#
# The Playwright steps need `build` first (the tests load dist/ in the browser and
# in Node). Their per-test cases go to $out/playwright-junit.xml.
set -uo pipefail
cd "$(dirname "$0")/.."

suite="${1:?usage: $0 <suite> <step>...}"; shift
out="test-results/$suite"
rm -rf "$out"; mkdir -p "$out"
cases="$out/cases.tsv"; : > "$cases"

# shellcheck source=pnpm-deps.sh
if ! source .aidev/pnpm-deps.sh; then
    printf 'case\tinstall\tfail\t0\tpnpm install --offline failed\n' >> "$cases"
    source .aidev/junit-helpers.sh; junit_write_cases "$out/junit.xml" "$suite" "$cases"
    exit 1
fi
source .aidev/junit-helpers.sh

status=0
step() {
    local name="$1"; shift
    local log="$out/$name.log" t0=$SECONDS rc=0
    echo "== $name" >&2
    "$@" > "$log" 2>&1 < /dev/null || rc=$?
    if [ "$rc" -eq 0 ]; then
        printf 'case\t%s\tpass\t%s\t\n' "$name" "$((SECONDS - t0))" >> "$cases"
    else
        status=1; tail -40 "$log" >&2
        printf 'case\t%s\tfail\t%s\texit %s\t%s\n' "$name" "$((SECONDS - t0))" "$rc" "$log" >> "$cases"
    fi
    return "$rc"
}

build() {
    rm -rf dist packages/blog-logic/dist \
        && pnpm exec tsc && pnpm exec tsc -p packages/blog-logic \
        && pnpm exec rollup -c \
        && pnpm exec tsx ./npm-common-config/ts-common/terser.ts \
        && pnpm exec size-limit
}

check_dist() {
    node -e '
const fs = require("fs");
const pkg = require("./package.json");
const flat = (e) => typeof e === "string" ? [e] : Object.values(e || {}).flatMap(flat);
const want = [pkg.main, pkg.types, ...flat(pkg.exports)].filter((f) => f && f !== "./package.json");
const missing = want.filter((f) => !fs.existsSync(f));
if (missing.length) { console.error("missing from the build:", missing.join(", ")); process.exit(1); }
console.log("dist provides", want.join(", "));'
}

# playwright <project>...: the CI `test` command (4 workers; package.json's
# `unset CI`) with a junit reporter, and its artifacts outside test-results/<suite>
# so Playwright's own output-dir cleanup can't remove this suite's reports.
playwright() {
    local junit="$out/playwright-junit.xml" log="$out/playwright.log" rc=0 args=()
    for p in "$@"; do args+=(--project="$p"); done
    (
        unset CI; export PLAYWRIGHT_JUNIT_OUTPUT_FILE="$junit"
        run_with_junit_fallback "$junit" "playwright" \
            pnpm exec playwright test --workers 4 "${args[@]}" \
                --reporter=junit,dot --output "$out/playwright-output"
    ) > "$log" || rc=$?
    if [ "$rc" -ne 0 ]; then
        junit_add_unreported_failure "$junit" "playwright" "playwright run failed" "$log" "$rc"
        tail -60 "$log"
    else
        tail -5 "$log"
    fi
    return "$rc"
}

for s in "$@"; do
    case "$s" in
        lint) step lint pnpm exec eslint --max-warnings=0 ;;
        typecheck) step typecheck bash -c 'pnpm exec tsc --noEmit && pnpm exec tsc --noEmit -p packages/blog-logic' ;;
        build) step build build && step dist-exports check_dist ;;
        docs) step docs scripts/generate_api_docs.sh "https://gitlab.syncad.com/hive/workerbee" "$(git rev-parse HEAD 2>/dev/null || echo HEAD)" "" "$out/docs" ;;
        test) step test playwright workerbee_testsuite ;;
        test-mock) step test-mock playwright workerbee_testsuite_mock ;;
        test-all) step test-all playwright workerbee_testsuite workerbee_testsuite_mock ;;
        *) echo "unknown step: $s" >&2; exit 2 ;;
    esac
done
junit_write_cases "$out/junit.xml" "$suite" "$cases"
exit "$status"
