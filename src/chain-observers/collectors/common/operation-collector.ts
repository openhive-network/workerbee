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

    const operations = transactions.flatMap(transaction =>
      transaction.transaction.operations.map(operation => ({
        operation,
        transaction
      }))
    );

    const operationsPerType = operations.reduce((operations, { operation, transaction }) => {
      let opType = "";
      for(const type in operation)
        if(operation[type] !== undefined) {
          opType = type;
          break;
        }

      if(operations[opType] === undefined)
        operations[opType] = [];

      operations[opType].push({
        operation: operation[opType],
        transaction
      });

      return operations;
    }, {} as Record<string, Array<IOperationTransactionPair>>);

    /*
     * XXX: Debugging code:
     * console.log("-", Object.entries(operationsPerType).map(([type, operations]) => `${type}: ${operations.length}`).join("\n- "));
     */

    return {
      OperationClassifier: {
        operations,
        operationsPerType
      }
    } satisfies Partial<TAvailableClassifiers>;
  };
}
