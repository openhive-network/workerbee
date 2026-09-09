/**
 * Types from the ESM-only Hive libraries, re-exported from one place.
 *
 * `@hiveio/wax` and `@hiveio/beekeeper` are both ESM-only. Under `module: node16`
 * TypeScript refuses a plain type import of an ES module from a CommonJS file
 * unless the import says which resolution mode to use, so the `resolution-mode`
 * attribute is spelled out here once instead of on every import site. Nothing in
 * this file survives compilation -- it is types only; the runtime reaches both
 * libraries through dynamic `import()`, in `chain.ts` and `broadcast.ts`.
 */
import type { IBeekeeperInstance, IBeekeeperUnlockedWallet, TPublicKey } from "@hiveio/beekeeper" with { "resolution-mode": "import" };
import type { asset, EManabarType, IHiveChainInterface } from "@hiveio/wax" with { "resolution-mode": "import" };

export type { asset, EManabarType, IBeekeeperInstance, IBeekeeperUnlockedWallet, IHiveChainInterface, TPublicKey };

/** The wax module namespace, as returned by `await import("@hiveio/wax")`. */
export type TWaxModule = typeof import("@hiveio/wax", { with: { "resolution-mode": "import" } });

/** The beekeeper module namespace, as returned by `await import("@hiveio/beekeeper")`. */
export type TBeekeeperModule = typeof import("@hiveio/beekeeper", { with: { "resolution-mode": "import" } });
