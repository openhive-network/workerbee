import type { WorkerBee } from "../../bot";
import { OperationClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { DataEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class InternalMarketFilter extends FilterBase {
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
    const { operationsPerType } = await data.get(OperationClassifier);

    for(const {} of (operationsPerType.limit_order_create2_operation ?? []))
      return true;

    for(const {} of (operationsPerType.limit_order_cancel_operation ?? []))
      return true;

    for(const {} of (operationsPerType.limit_order_create_operation ?? []))
      return true;

    return false;
  }
}
