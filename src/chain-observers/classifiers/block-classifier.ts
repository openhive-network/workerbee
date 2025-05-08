import type { transaction } from "@hiveio/wax";
import { CollectorClassifierBase } from "./collector-classifier-base";

export interface ITransactionData {
  transaction: transaction;
  id: string;
}

export interface IBlockData {
  transactions: ITransactionData[];
  transactionsPerId: Map<string, transaction>;
}

export class BlockClassifier extends CollectorClassifierBase<IBlockData> {

}
