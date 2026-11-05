import { OperationClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { TFilterEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class CustomOperationFilter extends FilterBase {
  public constructor(
    ids: Array<string | number>
  ) {
    super();

    this.ids = new Set(ids);
  }

  private readonly ids = new Set<string | number>();

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      OperationClassifier
    ];
  }

  public async match(data: TFilterEvaluationContext): Promise<boolean> {
    const { operationsPerType } = await data.get(OperationClassifier);

    for(const { operation } of (operationsPerType.custom_json_operation ?? []))
      if (this.ids.has(operation.id))
        return true;

    return false;
  }
}
