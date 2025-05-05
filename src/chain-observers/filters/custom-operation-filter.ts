import type { WorkerBee } from "../../bot";
import { OperationClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { DataEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class CustomOperationFilter extends FilterBase {
  public constructor(
    worker: WorkerBee,
    private readonly id: string | number
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

    for(const { operation } of (operationsPerType.custom_json_operation ?? []))
      if (operation.id === this.id)
        return true;

    for(const { operation } of (operationsPerType.custom_operation ?? []))
      if (operation.id === this.id)
        return true;

    return false;
  }
}
