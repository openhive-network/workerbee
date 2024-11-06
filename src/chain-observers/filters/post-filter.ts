import type { WorkerBee } from "../../bot";
import { ImpactedAccountClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { DataEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class PostFilter extends FilterBase {
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
    const { impactedAccounts } = await data.get(ImpactedAccountClassifier);

    const account = impactedAccounts[this.account];

    for(const { operation } of account.operations)
      if(operation.comment)
        if (operation.comment.author === this.account)
          return true;


    return false;
  }
}
