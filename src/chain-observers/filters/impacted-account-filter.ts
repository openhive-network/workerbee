import type { WorkerBee } from "../../bot";
import { ImpactedAccountClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { TFilterEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class ImpactedAccountFilter extends FilterBase {
  public constructor(
    worker: WorkerBee,
    accounts: string[]
  ) {
    super(worker);

    this.accounts = new Set(accounts);
  }

  private readonly accounts: Set<string>;

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      ImpactedAccountClassifier
    ];
  }

  public async match(data: TFilterEvaluationContext): Promise<boolean> {
    const impactedAccount = await data.get(ImpactedAccountClassifier);

    for(const account of this.accounts)
      if(impactedAccount.impactedAccounts[account] !== undefined)
        return true;

    return false;
  }
}
