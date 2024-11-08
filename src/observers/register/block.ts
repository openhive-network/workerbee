import { ITransaction } from "@hiveio/wax";
import type { IBlockData, ITransactionProtoData } from "../../interfaces";

export class BlockDataProvider {
  private transactionsData: ITransaction[];

  public constructor(
    private readonly block: IBlockData,
    transactions: ITransactionProtoData[],
  ) {
    this.transactionsData = transactions.map(({ transaction }) => transaction);
  }

  public get witness (): string {
    return this.block.block.witness;
  }

  public get timestamp (): Date {
    return new Date(`${this.block.block.timestamp}Z`);
  }

  public get number (): number {
    return this.block.number;
  }

  public get transactions (): ITransaction[] {
    return this.transactionsData;
  }
}
