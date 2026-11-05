import type { operation } from "@hiveio/wax";
import { ITransactionData } from "./block-classifier";
import { CollectorClassifierBase } from "./collector-classifier-base";

export interface IOperationTransactionPair<OpType = operation> {
  operation: OpType;
  transaction: ITransactionData;
}

export interface IOperationBaseData {
  operations: Iterable<IOperationTransactionPair>;
}

export interface IOperationData extends IOperationBaseData {
  operationsPerType: {
    [key in keyof operation]: Iterable<IOperationTransactionPair<Exclude<operation[key], undefined>>>;
  };
}

export class OperationClassifier extends CollectorClassifierBase<{}, IOperationData> {}
