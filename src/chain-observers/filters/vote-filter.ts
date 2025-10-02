import { OperationClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { TFilterEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class VoteFilter extends FilterBase {
  public constructor(
    accounts: string[]
  ) {
    super();

    this.accounts = new Set(accounts);
  }

  public readonly accounts: Set<string>;

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      OperationClassifier
    ];
  }

  public async match(data: TFilterEvaluationContext): Promise<boolean> {
    const { operationsPerType } = await data.get(OperationClassifier);

    if (operationsPerType.vote_operation === undefined)
      return false;

    for(const { operation } of operationsPerType.vote_operation)
      if (this.accounts.has(operation.voter))
        return true;

    // TODO: Handle witness vote in a separate filter and action in queen

    return false;
  }
}
