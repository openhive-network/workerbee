import type { ProvidersData } from "../providers-mediator";
import type { transaction } from '@hiveio/wax';
import { FilterBase } from "./filter-base";

type FilterType = (transaction: transaction) => void;

export class TransactionIdFilter extends FilterBase {
  private static filters: Record<string, FilterType[]> = {};

  public static registerFilter(filterFn: FilterType, txId: string) {
    if (this.filters[txId] === undefined)
      this.filters[txId] = [];

    this.filters[txId].push(filterFn);
  }

  public static unregisterFilter(filterFn: FilterType, txId: string) {
    if (this.filters[txId] === undefined)
      return;

    const index = this.filters[txId].indexOf(filterFn);

    if (index === -1)
      return;

    this.filters[txId].splice(index, 1);

    if (this.filters[txId].length === 0)
      delete this.filters[txId];
  }

  public async parse(data: ProvidersData) {
    if(Object.keys(TransactionIdFilter.filters).length === 0)
      return;

    const tx = await data.transactions;

    for(const txId in TransactionIdFilter.filters) {
      const transaction = tx.getTransactionId(txId);

      if (transaction === undefined)
        continue;

      for(const filterFn of TransactionIdFilter.filters[txId]!)
        filterFn(transaction);
    }
  }
}
