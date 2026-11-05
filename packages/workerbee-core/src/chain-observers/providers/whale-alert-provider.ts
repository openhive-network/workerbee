import type { asset } from "@hiveio/wax";
import { WorkerBeeIterable } from "../../types/iterator";
import { isGreaterThan } from "../../utils/assets";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { OperationClassifier, IOperationTransactionPair } from "../classifiers/operation-classifier";
import { TProviderEvaluationContext } from "../factories/data-evaluation-context";
import { ProviderBase } from "./provider-base";

export interface IWhaleAlertMetadata {
  from: string;
  to: string;
  amount: asset;
}

export interface IWhaleAlertProviderData {
  whaleOperations: WorkerBeeIterable<IOperationTransactionPair<IWhaleAlertMetadata>>;
};

export interface IWhaleAlertProviderOptions {
  assets: asset[];
}

export class WhaleAlertProvider extends ProviderBase<IWhaleAlertProviderOptions> {
  public readonly assets = new Map<string, asset>();

  public pushOptions(options: IWhaleAlertProviderOptions): void {
    for(const asset of options.assets)
      this.assets.set(asset.nai, asset);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      OperationClassifier
    ]
  }

  public async provide(data: TProviderEvaluationContext): Promise<IWhaleAlertProviderData> {
    const operations = await data.get(OperationClassifier);

    const transfer = operations.operationsPerType["transfer_operation"];
    const fromSavings = operations.operationsPerType["transfer_from_savings_operation"];
    const escrow = operations.operationsPerType["escrow_transfer_operation"];
    const recurrent = operations.operationsPerType["recurrent_transfer_operation"];

    const whaleOperations: IOperationTransactionPair<IWhaleAlertMetadata>[] = [];

    for(const asset of this.assets.values()) {
      if(transfer)
        for(const op of transfer)
          if(isGreaterThan(asset, op.operation.amount!))
            whaleOperations.push({
              operation: {
                from: op.operation.from,
                to: op.operation.to,
                amount: op.operation.amount!
              },
              transaction: op.transaction
            });

      if(fromSavings)
        for(const op of fromSavings)
          if(isGreaterThan(asset, op.operation.amount!))
            whaleOperations.push({
              operation: {
                from: op.operation.from,
                to: op.operation.to,
                amount: op.operation.amount!
              },
              transaction: op.transaction
            });

      if(escrow)
        for(const op of escrow)
          if(isGreaterThan(asset, op.operation.hbd_amount!))
            whaleOperations.push({
              operation: {
                from: op.operation.from,
                to: op.operation.to,
                amount: op.operation.hbd_amount!
              },
              transaction: op.transaction
            });
          else if(isGreaterThan(asset, op.operation.hive_amount!))
            whaleOperations.push({
              operation: {
                from: op.operation.from,
                to: op.operation.to,
                amount: op.operation.hive_amount!
              },
              transaction: op.transaction
            });

      if(recurrent)
        for(const op of recurrent)
          if(isGreaterThan(asset, op.operation.amount!))
            whaleOperations.push({
              operation: {
                from: op.operation.from,
                to: op.operation.to,
                amount: op.operation.amount!
              },
              transaction: op.transaction
            });
    }

    return {
      whaleOperations: new WorkerBeeIterable(whaleOperations)
    };
  }
}
