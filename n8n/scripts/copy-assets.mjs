/*
 * Tsc emits .js only. Icons and codex files have to be carried over by hand, and
 * they must land next to the .node.js file that references them. The bundled
 * WorkerBee runtime is copied for the same reason: `dist/nodes/shared/chain.js`
 * imports it as ../../workerbee/index.mjs, which only resolves once it is inside
 * dist/.
 */
import { cpSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const assets = new Set([".svg", ".json"]);

const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory())
      walk(full);
    else if (assets.has(entry.slice(entry.lastIndexOf("."))))
      cpSync(full, join(root, "dist", relative(root, full)));

  }
};

for (const dir of ["nodes", "credentials"]) walk(join(root, dir));

cpSync(join(root, "workerbee", "index.mjs"), join(root, "dist", "workerbee", "index.mjs"));
