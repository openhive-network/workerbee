/*
 * Bundles WorkerBee for the nodes - the core of ../packages/workerbee-core on the
 * JSON-RPC chain of ./workerbee-n8n - into one ESM file this package can load at
 * runtime.
 *
 * Why a bundle and not a plain `tsc`: the library's sources use extensionless
 * relative imports ("./bot"), which Node's ESM loader rejects. The library's own
 * release build solves that with rollup; this package solves it with esbuild,
 * which is one dependency instead of five and resolves the same way.
 *
 * The bundle must not load WebAssembly: an n8n community node may have no runtime
 * dependencies, so wax and beekeeper may be imported for their types only. An
 * import of either that survives into the bundle fails the build.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const { version } = JSON.parse(readFileSync(`${root}package.json`, "utf8"));

const noWebAssembly = {
  name: "no-webassembly",
  setup(builder) {
    builder.onResolve({ filter: /^@hiveio\/(wax|beekeeper)(\/|$)/ }, (args) => ({
      errors: [{ text: `${args.importer} imports ${args.path} at runtime - the n8n build of WorkerBee takes its types only` }],
    }));
  },
};

await build({
  entryPoints: [`${root}workerbee-n8n/index.ts`],
  outfile: `${root}workerbee/index.mjs`,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  define: { N8N_PACKAGE_VERSION: JSON.stringify(version) },
  plugins: [noWebAssembly],
  legalComments: "inline",
  logLevel: "info",
});
