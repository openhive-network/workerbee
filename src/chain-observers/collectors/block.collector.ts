import { type IBlockData } from "../../interfaces";
import { DataCollectorBase } from "./collector-base";

export class BlockCollector extends DataCollectorBase {
  public pushOptions(_data: { impactedAccount: string }): void {}

  /* eslint-disable-next-line require-await */
  public async fetchData(): Promise<IBlockData> {
    return this.registry.cachedBlock;
  }
}
