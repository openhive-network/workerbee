import type { ProvidersData } from "../providers-mediator";
import type { operation } from '@hiveio/wax';
import { FilterBase } from "./filter-base";

export class OperationFilter<T extends keyof operation> extends FilterBase {
  public constructor(
    private readonly operationType: T
  ) {
    super();
  }

  public aggregate() {
    return [
      "transactions"
    ] satisfies Array<keyof ProvidersData>;
  }

  public async match(data: Pick<ProvidersData, ReturnType<OperationFilter<T>['aggregate']>[number]>): Promise<operation[T][] | void> {
    const tx = await data.transactions;

    const txs = tx.getOperationsByType(this.operationType);

    if (txs.length === 0)
      return;

    return txs;
  }
}
