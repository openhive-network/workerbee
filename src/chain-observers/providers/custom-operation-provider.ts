import { custom, custom_json } from "@hiveio/wax";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { IOperationTransactionPair, OperationClassifier } from "../classifiers/operation-classifier";
import { TProviderEvaluationContext } from "../factories/data-evaluation-context";
import { ProviderBase } from "./provider-base";

export type TCustomOperationProvided<TOperationId extends Array<string | number>> = {
  [K in TOperationId[number]]: Array<IOperationTransactionPair<custom_json | custom>>;
};

export interface ICustomOperationProviderData<TOperationId extends Array<string | number>> {
  customOperations: Partial<TCustomOperationProvided<TOperationId>>;
};

export interface ICustomOperationProviderOptions {
  ids: Array<string | number>;
}

export class CustomOperationProvider<
  TOperationId extends Array<string | number> = Array<string | number>
> extends ProviderBase<ICustomOperationProviderOptions, ICustomOperationProviderData<TOperationId>> {
  public readonly ids = new Set<string | number>();

  public pushOptions(options: ICustomOperationProviderOptions): void {
    for(const id of options.ids)
      this.ids.add(id);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [OperationClassifier]
  }

  public get baseStructure(): ICustomOperationProviderData<TOperationId> {
    return {
      customOperations: {}
    };
  }

  public async provide(data: TProviderEvaluationContext): Promise<ICustomOperationProviderData<TOperationId>> {
    const result = this.baseStructure;

    const accounts = await data.get(OperationClassifier);
    if (accounts.operationsPerType.custom_json_operation)
      for(const operation of accounts.operationsPerType.custom_json_operation) {
        if (!this.ids.has(operation.operation.id))
          continue;

        if (!result.customOperations[operation.operation.id])
          result.customOperations[operation.operation.id] = [];

        result.customOperations[operation.operation.id].push({
          operation: operation.operation,
          transaction: operation.transaction
        });
      }

    if (accounts.operationsPerType.custom_operation)
      for(const operation of accounts.operationsPerType.custom_operation) {
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
