import type { TAccountName } from "@hiveio/wax";
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
    accounts: TAccountName[]
  ) {
    super(worker);

    this.accounts = new Set(accounts);
  }

  private readonly accounts: Set<TAccountName>;

  public usedContexts(): Array<TRegisterEvaluationContext> {
    const classifiers: TRegisterEvaluationContext[] = [];
    for (const account of this.accounts)
      classifiers.push(
        AccountClassifier.forOptions({ account }),
        ChangeRecoveryInProgressClassifier.forOptions({ changeRecoveryAccount: account }),
        DeclineVotingRightsClassifier.forOptions({ declineVotingRightsAccount: account })
      );

    return classifiers;
  }

  public async match(data: DataEvaluationContext): Promise<boolean> {
    const { accounts } = await data.get(AccountClassifier);

    for(const accountName of this.accounts) {
      const account = accounts[accountName];

      if (account === undefined)
        return false;

      if (account.recoveryAccount === STEEM_ACCOUNT_NAME)
        return true;

      if (account.governanceVoteExpiration === undefined)
        return true;

      if (account.governanceVoteExpiration!.getTime() < (Date.now() + ONE_MONTH_MS))
        return true;

      const { recoveringAccounts } = await data.get(ChangeRecoveryInProgressClassifier);

      if (recoveringAccounts[accountName])
        return true;

      const { declineVotingRightsAccounts } = await data.get(DeclineVotingRightsClassifier);

      if (declineVotingRightsAccounts[accountName])
        return true;
    }

    return false;
  }
}
