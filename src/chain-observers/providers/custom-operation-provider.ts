import { custom_json } from "@hiveio/wax";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { IOperationTransactionPair, OperationClassifier } from "../classifiers/operation-classifier";
import { DataEvaluationContext } from "../factories/data-evaluation-context";
import { ProviderBase } from "./provider-base";

export type TCustomOperationProvided<TOperationId extends Array<string>> = {
  [K in TOperationId[number]]: Array<IOperationTransactionPair<custom_json>>;
};

export interface ICustomOperationProviderData<TOperationId extends Array<string>> {
  customOperations: Partial<TCustomOperationProvided<TOperationId>>;
};

export interface ICustomOperationProviderOptions {
  ids: string[];
}

export class CustomOperationProvider<TOperationId extends Array<string> = Array<string>> extends ProviderBase<ICustomOperationProviderOptions> {
  public readonly ids = new Set<string>();

  public pushOptions(options: ICustomOperationProviderOptions): void {
    for(const id of options.ids)
      this.ids.add(id);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [OperationClassifier]
  }

  public async provide(data: DataEvaluationContext): Promise<ICustomOperationProviderData<TOperationId>> {
    const result = {
      customOperations: {}
    } as ICustomOperationProviderData<TOperationId>;

    const accounts = await data.get(OperationClassifier);
    if (accounts.operationsPerType.custom_json)
      for(const operation of accounts.operationsPerType.custom_json) {
        if (!this.ids.has(operation.operation.id))
          continue;

        if (!result.customOperations[operation.operation.id])
          result.customOperations[operation.operation.id] = [];

        result.customOperations[operation.operation.id].push({
          operation: operation.operation,
          transaction: operation.transaction
        });
      }

    return result;
  }
}
