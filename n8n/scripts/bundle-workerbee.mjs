/*
 * Bundles the WorkerBee library from ../src into one ESM file this package can
 * load at runtime.
 *
 * Why a bundle and not a plain `tsc` of ../src: the library's sources use
 * extensionless relative imports ("./bot"), which Node's ESM loader rejects.
 * The library's own release build solves that with rollup; this package solves
 * it with esbuild, which is one dependency instead of five and resolves the same
 * way. @hiveio/wax stays external -- it ships WebAssembly that must keep loading
 * from its own package directory.
 */
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));

await build({
  entryPoints: [`${root}../src/index.ts`],
  outfile: `${root}workerbee/index.mjs`,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  external: ["@hiveio/wax"],
  legalComments: "inline",
  logLevel: "info",
});
