import { price, type asset } from "@hiveio/wax";
import { WorkerBeeIterable } from "../../types/iterator";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { OperationClassifier, IOperationTransactionPair } from "../classifiers/operation-classifier";
import { DataEvaluationContext } from "../factories/data-evaluation-context";
import { ProviderBase } from "./provider-base";

export interface IInternalMarketOperationBase {
  owner: string;
  orderId: number;
}

export interface IInternalMarketCancelOperation extends IInternalMarketOperationBase {
  cancel: true;
}

export interface IInternalMarketCreateOperation extends IInternalMarketOperationBase {
  cancel: false;
  amountToSell: asset;
  filled: boolean;
  exchangeRate: price;
  expiration: Date;
}

export type TInternalMarketOperation = IInternalMarketCancelOperation | IInternalMarketCreateOperation;

export interface IInternalMarketProviderData {
  internalMarketOperations: WorkerBeeIterable<IOperationTransactionPair<TInternalMarketOperation>>;
};

export class InternalMarketProvider extends ProviderBase {
  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      OperationClassifier
    ]
  }

  public async provide(data: DataEvaluationContext): Promise<IInternalMarketProviderData> {
    const operations = await data.get(OperationClassifier);

    const orderCreate = operations.operationsPerType.limit_order_create_operation;
    const orderCreate2 = operations.operationsPerType.limit_order_create2_operation;
    const orderCancel = operations.operationsPerType.limit_order_cancel_operation;

    const internalMarketOperations: IOperationTransactionPair<TInternalMarketOperation>[] = [];

    if(orderCancel)
      for(const op of orderCancel)
        internalMarketOperations.push({
          operation: {
            cancel: true,
            owner: op.operation.owner,
            orderId: op.operation.orderid
          },
          transaction: op.transaction
        });

    if(orderCreate)
      for(const op of orderCreate)
        internalMarketOperations.push({
          operation: {
            cancel: false,
            owner: op.operation.owner,
            orderId: op.operation.orderid,
            amountToSell: op.operation.amount_to_sell!,
            filled: op.operation.fill_or_kill,
            exchangeRate: {
              base: op.operation.amount_to_sell,
              quote: op.operation.min_to_receive
            },
            expiration: new Date(`${op.operation.expiration}Z`)
          },
          transaction: op.transaction
        });

    if(orderCreate2)
      for(const op of orderCreate2)
        internalMarketOperations.push({
          operation: {
            cancel: false,
            owner: op.operation.owner,
            orderId: op.operation.orderid,
            amountToSell: op.operation.amount_to_sell!,
            filled: op.operation.fill_or_kill,
            exchangeRate: op.operation.exchange_rate!,
            expiration: new Date(`${op.operation.expiration}Z`)
          },
          transaction: op.transaction
        });

    return {
      internalMarketOperations: new WorkerBeeIterable(internalMarketOperations)
    };
  }
}
