import type { WorkerBee } from "../../bot";
import { OperationClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { TFilterEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class AccountCreatedFilter extends FilterBase {
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
    const { operationsPerType } = await data.get(OperationClassifier);

    for(const {} of (operationsPerType.account_create ?? []))
      return true;

    for(const {} of (operationsPerType.account_create_with_delegation ?? []))
      return true;

    for(const {} of (operationsPerType.create_claimed_account ?? []))
      return true;

    return false;
  }
}
