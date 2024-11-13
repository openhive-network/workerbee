import { ITransaction, operation, transaction } from "@hiveio/wax";
import { CollectorsData } from "../providers-mediator";
import { DataProviderBase } from "./provider-base";

export class TransactionProvider extends DataProviderBase {
  private transactionIds = new Set<string>();
  private transactions: ITransaction[] = [];
  private impactedTransactions: Record<string, transaction[]> = {};
  private impactedOperations: Record<string, operation[]> = {};

  public getImpactedTransactionsForAccount(account: string): transaction[] {
    return this.impactedTransactions[account] ?? [];
  }

  public getImpactedOperationsForAccount(account: string): operation[] {
    return this.impactedOperations[account] ?? [];
  }

  public hasTransactionId(id: string): boolean {
    return this.transactionIds.has(id);
  }

  private fetchImpacted() {
    for(const transaction of this.transactions) {
      const impactedAccounts = new Set<string>();

      for(const operation of transaction.transaction.operations) {
        const impactedOperationAccounts = this.registry.chain.operationGetImpactedAccounts(operation);

        for(const account of impactedOperationAccounts) {
          impactedAccounts.add(account);

          if (!this.impactedOperations[account])
            this.impactedOperations[account] = [];

          this.impactedOperations[account].push(operation);
        }

        for(const account of impactedAccounts) {
          if (!this.impactedTransactions[account])
            this.impactedTransactions[account] = [];

          this.impactedTransactions[account].push(transaction.transaction);
        }
      }
    }
  }

  public async parseData(data: CollectorsData): Promise<Omit<this, keyof DataProviderBase>> {
    const { block: { transaction_ids, transactions } } = await data.block;

    this.transactionIds = new Set(transaction_ids);

    for(const tx of transactions)
      this.transactions.push(this.registry.chain.createTransactionFromJson(tx));

    this.fetchImpacted();

    return this;
  }
}
