import type { WorkerBee } from "../../bot";
import { isExchange } from "../../utils/known-exchanges";
import { OperationClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { DataEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class ExchangeTransferFilter extends FilterBase {
  public constructor(
    worker: WorkerBee
  ) {
    super(worker);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      OperationClassifier
    ];
  }

  public async match(data: DataEvaluationContext): Promise<boolean> {
    const operations = await data.get(OperationClassifier);

    const transfer = operations.operationsPerType["transfer"];
    const fromSavings = operations.operationsPerType["transfer_from_savings"];
    const escrow = operations.operationsPerType["escrow_transfer"];
    const recurrent = operations.operationsPerType["recurrent_transfer"];

    if(transfer)
      for(const op of transfer)
        if(isExchange(op.operation.from_account))
          return true;

    if(fromSavings)
      for(const op of fromSavings)
        if(isExchange(op.operation.from_account))
          return true;

    if(escrow)
      for(const op of escrow)
        if(isExchange(op.operation.from_account))
          return true;

    if(recurrent)
      for(const op of recurrent)
        if(isExchange(op.operation.from_account))
          return true;

    return false;
  }
}
