import type { asset } from "@hiveio/wax";
import { WorkerBeeIterable } from "../../types/iterator";
import { isGreaterThan } from "../../utils/assets";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { OperationClassifier, IOperationTransactionPair } from "../classifiers/operation-classifier";
import { DataEvaluationContext } from "../factories/data-evaluation-context";
import { ProviderBase } from "./provider-base";

export interface IWhaleAlertMetadata {
  from: string;
  to: string;
  amount: asset;
}

export interface IWhaleAlertProviderData {
  whaleOperations: WorkerBeeIterable<IOperationTransactionPair<IWhaleAlertMetadata>>;
};

export class WhaleAlertProvider extends ProviderBase {
  public constructor(
    private readonly asset: asset
  ) {
    super();
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      OperationClassifier
    ]
  }

  public async provide(data: DataEvaluationContext): Promise<IWhaleAlertProviderData> {
    const operations = await data.get(OperationClassifier);

    const transfer = operations.operationsPerType["transfer"];
    const fromSavings = operations.operationsPerType["transfer_from_savings"];
    const escrow = operations.operationsPerType["escrow_transfer"];
    const recurrent = operations.operationsPerType["recurrent_transfer"];

    const whaleOperations: IOperationTransactionPair<IWhaleAlertMetadata>[] = [];

    if(transfer)
      for(const op of transfer)
        if(isGreaterThan(this.asset, op.operation.amount!))
          whaleOperations.push({
            operation: {
              from: op.operation.from_account,
              to: op.operation.to_account,
              amount: op.operation.amount!
            },
            transaction: op.transaction
          });

    if(fromSavings)
      for(const op of fromSavings)
        if(isGreaterThan(this.asset, op.operation.amount!))
          whaleOperations.push({
            operation: {
              from: op.operation.from_account,
              to: op.operation.to_account,
              amount: op.operation.amount!
            },
            transaction: op.transaction
          });

    if(escrow)
      for(const op of escrow)
        if(isGreaterThan(this.asset, op.operation.hbd_amount!))
          whaleOperations.push({
            operation: {
              from: op.operation.from_account,
              to: op.operation.to_account,
              amount: op.operation.hbd_amount!
            },
            transaction: op.transaction
          });
        else if(isGreaterThan(this.asset, op.operation.hive_amount!))
          whaleOperations.push({
            operation: {
              from: op.operation.from_account,
              to: op.operation.to_account,
              amount: op.operation.hive_amount!
            },
            transaction: op.transaction
          });

    if(recurrent)
      for(const op of recurrent)
        if(isGreaterThan(this.asset, op.operation.amount!))
          whaleOperations.push({
            operation: {
              from: op.operation.from_account,
              to: op.operation.to_account,
              amount: op.operation.amount!
            },
            transaction: op.transaction
          });

    return {
      whaleOperations: new WorkerBeeIterable(whaleOperations)
    };
  }
}
