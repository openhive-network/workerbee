// We only want to import types here!
import type beekeeperFactoryType from "@hiveio/beekeeper/web";
import type * as Wax from "@hiveio/wax";

import type WorkerBee from "../../dist/bundle/index";

export type TEnvType = "web" | "node";

// Define global interfaces:
export interface IWorkerBeeGlobals {
  beekeeperFactory: typeof beekeeperFactoryType;
  WorkerBee: typeof WorkerBee;
  wax: typeof Wax;
}

declare global {
  function createTestFor(env: TEnvType): Promise<IWorkerBeeGlobals>;
}
