import { BlockClassifier, OperationClassifier } from "../../classifiers";
import { TRegisterEvaluationContext } from "../../classifiers/collector-classifier-base";
import { IOperationTransactionPair } from "../../classifiers/operation-classifier";
import { TCollectorEvaluationContext } from "../../factories/data-evaluation-context";
import { CollectorBase, TAvailableClassifiers } from "../collector-base";

export class OperationCollector extends CollectorBase<OperationClassifier> {
  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [BlockClassifier];
  }

  public async get(data: TCollectorEvaluationContext) {
    const { transactions } = await data.get(BlockClassifier);

    const operations: Array<IOperationTransactionPair> = [];
    const operationsPerType: Record<string, Array<IOperationTransactionPair>> = {};

    const startOperationPerType = Date.now();

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

    data.addTiming("operationPerType", Date.now() - startOperationPerType);

    return {
      /*
       * Instruct TypeScript typings that OperationClassifier.name is actualy a Classifier name we expect.
       * This is required for the bundlers to properly deduce the type of the classifier in data evaluation context.
       */
      [OperationClassifier.name as "OperationClassifier"]: {
        operations,
        operationsPerType
      } as TAvailableClassifiers["OperationClassifier"]
    };
  };
}
