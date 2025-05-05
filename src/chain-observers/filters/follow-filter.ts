import type { WorkerBee } from "../../bot";
import { OperationClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { DataEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class FollowFilter extends FilterBase {
  public constructor(
    worker: WorkerBee,
    private readonly account: string
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
      if (operation.id === "follow") {
        const json = JSON.parse(operation.json);

        if (json[0] === "follow" && json[1].follower === this.account)
          return true;
      }

    return false;
  }
}
