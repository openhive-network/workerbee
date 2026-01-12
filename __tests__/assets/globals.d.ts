// We only want to import types here!
import type beekeeperFactoryType from "@hiveio/beekeeper";
import type * as Wax from "@hiveio/wax";

import type WorkerBee from "../../src/index";

import type * as WorkerBeePackage from "../../src/index";

export type TEnvType = "web" | "node";

// Define global interfaces:
export interface IWorkerBeeGlobals {
  beekeeperFactory: typeof beekeeperFactoryType;
  WorkerBee: typeof WorkerBee;
  WorkerBeePackage: typeof WorkerBeePackage;
  wax: typeof Wax;
  chain: Wax.IHiveChainInterface;
  bot: WorkerBeePackage.IWorkerBee;
}

declare global {
  function createTestFor(env: TEnvType): Promise<IWorkerBeeGlobals>;
}
