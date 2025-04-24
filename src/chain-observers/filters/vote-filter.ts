import type { WorkerBee } from "../../bot";
import { OperationClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { DataEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class VoteFilter extends FilterBase {
  public constructor(
    worker: WorkerBee,
    accounts: string[]
  ) {
    super(worker);

    this.accounts = new Set(accounts);
  }

  public readonly accounts: Set<string>;

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      OperationClassifier
    ];
  }

  public async match(data: DataEvaluationContext): Promise<boolean> {
    const { operationsPerType } = await data.get(OperationClassifier);

    if (operationsPerType.vote === undefined)
      return false;

    for(const { operation } of operationsPerType.vote)
      if (this.accounts.has(operation.author))
        return true;

    // TODO: Handle witness vote in a separate filter and action in queen

    return false;
  }
}
