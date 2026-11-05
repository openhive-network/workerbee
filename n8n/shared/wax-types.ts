/**
 * Types from the ESM-only wax, re-exported from one place.
 *
 * Under `module: node16` TypeScript refuses a plain type import of an ES module
 * from a CommonJS file unless the import says which resolution mode to use, so the
 * `resolution-mode` attribute is spelled out here once instead of on every import
 * site. Nothing in this file survives compilation -- it is types only, and wax is
 * a development dependency: the package never loads it.
 */
import type { asset, EManabarType } from "@hiveio/wax" with { "resolution-mode": "import" };

export type { asset, EManabarType };
