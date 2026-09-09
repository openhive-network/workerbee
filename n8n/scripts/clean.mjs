/*
 * Empties the build outputs without removing the directories themselves. A bind
 * mount resolves its source once, so deleting the directory would detach it from
 * a running n8n container and every node would vanish until the container
 * restarts.
 */
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

for (const name of ["dist", "workerbee"]) {
  const dir = fileURLToPath(new URL(`../${name}`, import.meta.url));
  mkdirSync(dir, { recursive: true });
  for (const entry of readdirSync(dir)) rmSync(join(dir, entry), { recursive: true, force: true });
}
