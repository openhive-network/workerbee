import type { WorkerBee } from "../../bot";
import { ImpactedAccountClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { DataEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class ImpactedAccountFilter extends FilterBase {
  public constructor(
    worker: WorkerBee,
    private readonly account: string
  ) {
    super(worker);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      ImpactedAccountClassifier
    ];
  }

  public async match(data: DataEvaluationContext): Promise<boolean> {
    const impactedAccount = await data.get(ImpactedAccountClassifier);

    return impactedAccount.impactedAccounts[this.account] !== undefined;
  }
}
