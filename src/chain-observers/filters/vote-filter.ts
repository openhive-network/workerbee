import type { WorkerBee } from "../../bot";
import { ImpactedAccountClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { DataEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class VoteFilter extends FilterBase {
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
      if(operation.vote) {
        if (operation.vote.author === this.account)
          return true;
      } else if (operation.account_witness_vote)
        if (operation.account_witness_vote.account === this.account && operation.account_witness_vote.approve)
          return true;


    return false;
  }
}
