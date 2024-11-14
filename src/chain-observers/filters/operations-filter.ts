import type { ProvidersData } from "../providers-mediator";
import type { operation } from '@hiveio/wax';
import { FilterBase } from "./filter-base";

type FilterType<K extends keyof operation> = (operations: Array<Exclude<operation[K], undefined>>) => void;

export class OperationFilter extends FilterBase {
  private static filters: Partial<{
    [K in keyof operation]: Array<FilterType<K>>;
  }> = {};

  public static registerFilter<K extends keyof operation>(filterFn: FilterType<K>, operation: K) {
    if (this.filters[operation] === undefined)
      this.filters[operation] = [];

    this.filters[operation].push(filterFn);
  }

  public static unregisterFilter<K extends keyof operation>(filterFn: FilterType<K>, operation: K) {
    if (this.filters[operation] === undefined)
      return;

    const index = this.filters[operation].indexOf(filterFn);

    if (index === -1)
      return;

    this.filters[operation].splice(index, 1);

    if (this.filters[operation].length === 0)
      delete this.filters[operation];
  }

  public async parse(data: ProvidersData) {
    const tx = await data.transactions;

    for(const filterOpName in OperationFilter.filters) {
      const filterOp = filterOpName as keyof operation;

      const txs = tx.getOperationsByType(filterOp);

      if (txs.length === 0)
        continue;

      for(const filterFn of OperationFilter.filters[filterOp]!)
        filterFn(txs as any);
    }
  }
}
