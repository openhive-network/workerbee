import type { IHiveChainInterface, TWaxExtended } from "@hiveio/wax";

import { WorkerBeeCore } from "../packages/workerbee-core/src/bot";
import type { IWorkerBeeRuntime } from "../packages/workerbee-core/src/interfaces";
import type { WaxExtendTypes } from "../packages/workerbee-core/src/wax";

const timersRuntime: IWorkerBeeRuntime = {
  every(callback: () => void, intervalMs: number): () => void {
    const intervalId = setInterval(callback, intervalMs);

    return () => clearInterval(intervalId);
  },
  after(callback: () => void, delayMs: number): () => void {
    const timeoutId = setTimeout(callback, delayMs);

    return () => clearTimeout(timeoutId);
  },
  get version(): string {
    return process.env.npm_package_version as string;
  }
};

export class WorkerBee extends WorkerBeeCore<TWaxExtended<WaxExtendTypes>> {
  public constructor(
    chain: IHiveChainInterface
  ) {
    super(chain.extend<WaxExtendTypes>(), timersRuntime);
  }
}
