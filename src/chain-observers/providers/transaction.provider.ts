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

  public aggregate() {
    return [
      "block"
    ] satisfies Array<keyof CollectorsData>;
  }

  public async parseData(data: Pick<CollectorsData, ReturnType<TransactionProvider['aggregate']>[number]>): Promise<Omit<this, keyof DataProviderBase>> {
    const { block: { transaction_ids, transactions } } = await data.block;

    for(const tx of transactions) {
      const iTx = this.mediator.chain.createTransactionFromJson(tx);

      const protoTx = iTx.transaction;

      this.transactions.push(iTx);
      this.protoTransactions.push(protoTx);

      for(const op of protoTx.operations) {
        let opType: keyof operation | undefined;
        for(const opTypePossiblyUndefined in op)
          if (op[opTypePossiblyUndefined] !== undefined) {
            opType = opTypePossiblyUndefined as keyof operation;
            break;
          }
        // This should never happen
        if (!opType)
          continue;

        if(this.operations[opType] === undefined)
          this.operations[opType] = [];

        this.operations[opType]!.push(op[opType] as any);
      }
    }

    this.transactionIds = new Map(transaction_ids.map((id, index) => [id, this.protoTransactions[index]]));

    this.fetchImpacted();

    return this;
  }
}
