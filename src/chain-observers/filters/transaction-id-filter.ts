import type { ProvidersData } from "../providers-mediator";
import type { transaction } from '@hiveio/wax';
import { FilterBase } from "./filter-base";

export class TransactionIdFilter extends FilterBase {
  public constructor(
    private readonly transactionId: string
  ) {
    super();
  }

  public aggregate() {
    return [
      "transactions"
    ] satisfies Array<keyof ProvidersData>;
  }

  public async match(data: Pick<ProvidersData, ReturnType<TransactionIdFilter['aggregate']>[number]>): Promise<transaction | void> {
    const tx = await data.transactions;

    const transaction = tx.getTransactionId(this.transactionId);

    return transaction;
  }
}
