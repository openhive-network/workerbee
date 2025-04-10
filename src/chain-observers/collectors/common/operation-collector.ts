import { BlockClassifier } from "../../classifiers";
import { TRegisterEvaluationContext } from "../../classifiers/collector-classifier-base";
import { IOperationTransactionPair } from "../../classifiers/operation-classifier";
import { DataEvaluationContext } from "../../factories/data-evaluation-context";
import { CollectorBase, TAvailableClassifiers } from "../collector-base";

export class OperationCollector extends CollectorBase {
  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [BlockClassifier];
  }

  public async fetchData(data: DataEvaluationContext) {
    const { transactions } = await data.get(BlockClassifier);

    const operations: Array<IOperationTransactionPair> = [];
    const operationsPerType: Record<string, Array<IOperationTransactionPair>> = {};

    for(const transaction of transactions)
      for(const operation of transaction.transaction.operations) {
        operations.push({
          operation,
          transaction
        });

        let opType = "";
        for(const type in operation)
          if(operation[type] !== undefined) {
            opType = type;
            break;
          }

        if(operationsPerType[opType] === undefined)
          operationsPerType[opType] = [];

        operationsPerType[opType].push({
          operation: operation[opType],
          transaction
        });
      }


    return {
      OperationClassifier: {
        operations,
        operationsPerType
      }
    } satisfies Partial<TAvailableClassifiers>;
  };
}
