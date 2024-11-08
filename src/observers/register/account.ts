import type { ApiAccount, ITransaction } from "@hiveio/wax";
import type { IOperationData } from "../../interfaces";

export interface IAccountMetadata {
  postingMetadata: string;
  accountMetadata: string;
}

export class AccountDataProvider {
  public constructor(
    private readonly account: ApiAccount,
    private readonly impactedOperationsData: IOperationData[],
    private readonly impactedTransactionsData: ITransaction[]
  ) {}

  public get impactedOperations(): IOperationData[] {
    return this.impactedOperationsData;
  }

  public get impactedTransactions(): ITransaction[] {
    return this.impactedTransactionsData;
  }

  public get metadata(): IAccountMetadata {
    return {
      postingMetadata: this.account.posting_json_metadata,
      accountMetadata: this.account.json_metadata
    };
  }

  public get name(): string {
    return this.account.name;
  }
}
