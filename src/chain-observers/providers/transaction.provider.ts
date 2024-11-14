import { ITransaction, operation, transaction } from "@hiveio/wax";
import { CollectorsData } from "../providers-mediator";
import { DataProviderBase } from "./provider-base";

export class TransactionProvider extends DataProviderBase {
  private transactionIds: Map<string, transaction> = new Map();
  private transactions: ITransaction[] = [];
  private protoTransactions: transaction[] = [];
  private operations: {
    [K in keyof operation]: Exclude<operation[K], undefined>[];
  } = {};
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

  public getTransactionId(id: string): transaction | undefined {
    return this.transactionIds.get(id);
  }

  public [Symbol.iterator] () {
    return this.protoTransactions[Symbol.iterator]();
  }

  public getOperationsByType<T extends keyof operation>(type: T): Exclude<operation[T], undefined>[] {
    return this.operations[type] ?? [];
  }

  private fetchImpacted() {
    for(const transaction of this.transactions) {
      const impactedAccounts = new Set<string>();

      for(const operation of transaction.transaction.operations) {
        const impactedOperationAccounts = this.mediator.chain.operationGetImpactedAccounts(operation);

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

    for(const tx of transactions) {
      const iTx = this.mediator.chain.createTransactionFromJson(tx);

      this.transactions.push(iTx);
      this.protoTransactions.push(iTx.transaction);

      for(const op of tx.operations) {
        const opType: keyof operation = op.type.slice(0, -10) as keyof operation;

        if(this.operations[opType] === undefined)
          this.operations[opType] = [];

        this.operations[opType].push(op[opType]);
      }
    }

    this.transactionIds = new Map(transaction_ids.map((id, index) => [id, this.protoTransactions[index]]));

    this.fetchImpacted();

    return this;
  }
}