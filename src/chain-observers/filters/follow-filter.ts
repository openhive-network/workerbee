import type { TAccountName } from "@hiveio/wax";
import type { WorkerBee } from "../../bot";
import { OperationClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { TFilterEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class FollowFilter extends FilterBase {
  public constructor(
    worker: WorkerBee,
    accounts: TAccountName[]
  ) {
    super(worker);

    this.accounts = new Set(accounts);
  }

  private readonly accounts: Set<TAccountName>;

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      OperationClassifier
    ];
  }

  public async match(data: TFilterEvaluationContext): Promise<boolean> {
    const { operationsPerType } = await data.get(OperationClassifier);

    for(const { operation } of (operationsPerType.custom_json_operation ?? []))
      if (operation.id === "follow")
        try {
          const json = JSON.parse(operation.json);

          if (json[0] === "follow" && this.accounts.has(json[1].follower))
            return true;
        // eslint-disable-next-line no-empty
        } catch {}


    return false;
  }
}
