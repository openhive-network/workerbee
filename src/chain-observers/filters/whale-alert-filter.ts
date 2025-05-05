import type { asset } from "@hiveio/wax";
import type { WorkerBee } from "../../bot";
import { isGreaterThan } from "../../utils/assets";
import { OperationClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { DataEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class WhaleAlertFilter extends FilterBase {
  /**
   * @param worker @internal
   * @param amount Any amount - HIVE/HBD in coins (no precision)
   */
  public constructor(
    worker: WorkerBee,
    private readonly asset: asset
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

    const transfer = operations.operationsPerType.transfer_operation;
    const fromSavings = operations.operationsPerType.transfer_from_savings_operation;
    const escrow = operations.operationsPerType.escrow_transfer_operation;
    const recurrent = operations.operationsPerType.recurrent_transfer_operation;

    if(transfer)
      for(const op of transfer)
        if(isGreaterThan(this.asset, op.operation.amount!))
          return true;

    if(fromSavings)
      for(const op of fromSavings)
        if(isGreaterThan(this.asset, op.operation.amount!))
          return true;

    if(escrow)
      for(const op of escrow)
        if(isGreaterThan(this.asset, op.operation.hbd_amount!))
          return true;
        else if(isGreaterThan(this.asset, op.operation.hive_amount!))
          return true;

    if(recurrent)
      for(const op of recurrent)
        if(isGreaterThan(this.asset, op.operation.amount!))
          return true;

    return false;
  }
}
