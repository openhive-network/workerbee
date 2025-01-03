import type { asset } from "@hiveio/wax";
import { WorkerBeeIterable } from "../../types/iterator";
import { Exchange, isExchange } from "../../utils/known-exchanges";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { OperationClassifier, IOperationTransactionPair } from "../classifiers/operation-classifier";
import { DataEvaluationContext } from "../factories/data-evaluation-context";
import { ProviderBase } from "./provider-base";

export interface IExchangeTransferMetadata {
  from: string;
  to: string;
  amount: asset;
  exchange: Exchange;
}

export interface IExchangeTransferProviderData {
  exchangeTransferOperations: WorkerBeeIterable<IOperationTransactionPair<IExchangeTransferMetadata>>;
};

/**
 * Note: On escrow_transfer operation, hbd_amount is used as the general-purpose amount field.
 * This is because the escrow_transfer operation is used for both HIVE and HBD transfers.
 * If you want to extract the HIVE amount, you should extract it directly from the provided operations within transaction.
 */
export class ExchangeTransferProvider extends ProviderBase {
  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      OperationClassifier
    ]
  }

  public async provide(data: DataEvaluationContext): Promise<IExchangeTransferProviderData> {
    const operations = await data.get(OperationClassifier);

    const transfer = operations.operationsPerType["transfer"];
    const fromSavings = operations.operationsPerType["transfer_from_savings"];
    const escrow = operations.operationsPerType["escrow_transfer"];
    const recurrent = operations.operationsPerType["recurrent_transfer"];

    const exchangeTransfers: IOperationTransactionPair<IExchangeTransferMetadata>[] = [];

    if(transfer)
      for(const op of transfer) {
        const exchange = isExchange(op.operation.from_account);

        if (exchange)
          exchangeTransfers.push({
            operation: {
              from: op.operation.from_account,
              to: op.operation.to_account,
              amount: op.operation.amount!,
              exchange
            },
            transaction: op.transaction
          });
      }

    if(fromSavings)
      for(const op of fromSavings) {
        const exchange = isExchange(op.operation.from_account);

        if (exchange)
          exchangeTransfers.push({
            operation: {
              from: op.operation.from_account,
              to: op.operation.to_account,
              amount: op.operation.amount!,
              exchange
            },
            transaction: op.transaction
          });
      }

    if(escrow)
      for(const op of escrow) {
        const exchange = isExchange(op.operation.from_account);

        if (exchange)
          exchangeTransfers.push({
            operation: {
              from: op.operation.from_account,
              to: op.operation.to_account,
              amount: op.operation.hbd_amount!,
              exchange
            },
            transaction: op.transaction
          });
      }

    if(recurrent)
      for(const op of recurrent) {
        const exchange = isExchange(op.operation.from_account);

        if (exchange)
          exchangeTransfers.push({
            operation: {
              from: op.operation.from_account,
              to: op.operation.to_account,
              amount: op.operation.amount!,
              exchange
            },
            transaction: op.transaction
          });
      }

    return {
      exchangeTransferOperations: new WorkerBeeIterable(exchangeTransfers)
    };
  }
}
