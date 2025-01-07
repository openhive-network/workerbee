import type { WorkerBee } from "../../bot";
import { AccountClassifier, ChangeRecoveryInProgressClassifier, DeclineVotingRightsClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { DataEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export const STEEM_ACCOUNT_NAME = "steem";
export const ONE_MONTH_MS = 1000 * 60 * 60 * 24 * 31;

export class AlarmFilter extends FilterBase {
  public constructor(
    worker: WorkerBee,
    private readonly account: string
  ) {
    super(worker);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      AccountClassifier.forOptions({ account: this.account }),
      ChangeRecoveryInProgressClassifier.forOptions({ changeRecoveryAccount: this.account }),
      DeclineVotingRightsClassifier.forOptions({ declineVotingRightsAccount: this.account })
    ];
  }

  public async match(data: DataEvaluationContext): Promise<boolean> {
    const { accounts } = await data.get(AccountClassifier);

    if (accounts[this.account].recoveryAccount === STEEM_ACCOUNT_NAME)
      return true;

    if (accounts[this.account].governanceVoteExpiration === undefined)
      return true;

    if (accounts[this.account].governanceVoteExpiration!.getTime() < (Date.now() + ONE_MONTH_MS))
      return true;

    const { recoveringAccounts } = await data.get(ChangeRecoveryInProgressClassifier);

    if (recoveringAccounts[this.account])
      return true;

    const { declineVotingRightsAccounts } = await data.get(DeclineVotingRightsClassifier);

    if (declineVotingRightsAccounts[this.account])
      return true;

    return false;
  }
}
