import type { WorkerBee } from "../../bot";
import { isExchange } from "../../utils/known-exchanges";
import { OperationClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { TFilterEvaluationContext } from "../factories/data-evaluation-context";
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

  public async match(data: TFilterEvaluationContext): Promise<boolean> {
    const operations = await data.get(OperationClassifier);

    const transfer = operations.operationsPerType["transfer_operation"];
    const fromSavings = operations.operationsPerType["transfer_from_savings_operation"];
    const escrow = operations.operationsPerType["escrow_transfer_operation"];
    const recurrent = operations.operationsPerType["recurrent_transfer_operation"];

    if(transfer)
      for(const op of transfer)
        if(isExchange(op.operation.from))
          return true;

    if(fromSavings)
      for(const op of fromSavings)
        if(isExchange(op.operation.from))
          return true;

    if(escrow)
      for(const op of escrow)
        if(isExchange(op.operation.from))
          return true;

    if(recurrent)
      for(const op of recurrent)
        if(isExchange(op.operation.from))
          return true;

    return false;
  }
}
