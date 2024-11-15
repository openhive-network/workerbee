import type { BlockProvider } from "../providers/block.provider";
import type { DataProviderBase } from "../providers/provider-base";
import type { ProvidersData } from "../providers-mediator";
import { FilterBase } from "./filter-base";

export class BlockNumberFilter extends FilterBase {
  public constructor(
    private readonly number: number
  ) {
    super();
  }

  public aggregate() {
    return [
      "block"
    ] satisfies Array<keyof ProvidersData>;
  }

  public async match(data: Pick<ProvidersData, ReturnType<BlockNumberFilter["aggregate"]>[number]>):
    Promise<Omit<BlockProvider, keyof DataProviderBase> | void> {
    const block = await data.block;

    if(block.number === this.number)
      return block;
  }
}
