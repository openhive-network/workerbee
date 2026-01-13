import { TAccountName } from "@hiveio/wax";
import { WorkerBeeIterable } from "../../types/iterator";
import { AccountClassifier, ChangeRecoveryInProgressClassifier, DeclineVotingRightsClassifier } from "../classifiers";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { TProviderEvaluationContext } from "../factories/data-evaluation-context";
import { ONE_MONTH_MS, STEEM_ACCOUNT_NAME } from "../filters/alarm-filter";
import { ProviderBase } from "./provider-base";

export const EAlarmType = {
  LEGACY_RECOVERY_ACCOUNT_SET: 0,
  GOVERNANCE_VOTE_EXPIRATION_SOON: 1,
  GOVERNANCE_VOTE_EXPIRED: 2,
  RECOVERY_ACCOUNT_IS_CHANGING: 3,
  DECLINING_VOTING_RIGHTS: 4
} as const;

export type EAlarmType = typeof EAlarmType[keyof typeof EAlarmType];

export type TAlarmAccounts<TAccounts extends Array<TAccountName>> = {
  [K in TAccounts[number]]: WorkerBeeIterable<EAlarmType>;
};

export interface IAlarmAccountsData<TAccounts extends Array<TAccountName>> {
  alarmsPerAccount: Partial<TAlarmAccounts<TAccounts>>;
};

export interface IAlarmProviderOptions {
  accounts: string[];
}

export class AlarmProvider<TAccounts extends Array<TAccountName> = Array<TAccountName>> extends ProviderBase<IAlarmProviderOptions> {
  public readonly accounts = new Set<TAccountName>();

  public pushOptions(options: IAlarmProviderOptions): void {
    for(const account of options.accounts)
      this.accounts.add(account);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    const contexts: TRegisterEvaluationContext[] = [];

    for(const account of this.accounts)
      contexts.push(
        AccountClassifier.forOptions({ account }),
        ChangeRecoveryInProgressClassifier.forOptions({ changeRecoveryAccount: account }),
        DeclineVotingRightsClassifier.forOptions({ declineVotingRightsAccount: account })
      );

    return contexts;
  }

  public async provide(data: TProviderEvaluationContext): Promise<IAlarmAccountsData<TAccounts>> {
    const result: IAlarmAccountsData<TAccounts> = {
      alarmsPerAccount: {} as TAlarmAccounts<TAccounts>
    };

    const ensureHasAccount = (account: TAccountName) => {
      if (result.alarmsPerAccount[account] === undefined)
        result.alarmsPerAccount[account] = [];

      return result.alarmsPerAccount[account];
    };

    const { accounts } = await data.get(AccountClassifier);
    for(const account of this.accounts) {
      if (accounts[account].recoveryAccount === STEEM_ACCOUNT_NAME)
        ensureHasAccount(account).push(EAlarmType.LEGACY_RECOVERY_ACCOUNT_SET);

      if (accounts[account].governanceVoteExpiration === undefined)
        ensureHasAccount(account).push(EAlarmType.GOVERNANCE_VOTE_EXPIRED);
      else if (accounts[account].governanceVoteExpiration!.getTime() < (Date.now() + ONE_MONTH_MS))
        ensureHasAccount(account).push(EAlarmType.GOVERNANCE_VOTE_EXPIRATION_SOON);
    }

    const { recoveringAccounts } = await data.get(ChangeRecoveryInProgressClassifier);

    for(const account of this.accounts)
      if (recoveringAccounts[account])
        ensureHasAccount(account).push(EAlarmType.RECOVERY_ACCOUNT_IS_CHANGING);

    const { declineVotingRightsAccounts } = await data.get(DeclineVotingRightsClassifier);

    for(const account of this.accounts)
      if (declineVotingRightsAccounts[account])
        ensureHasAccount(account).push(EAlarmType.DECLINING_VOTING_RIGHTS);

    for(const account in result.alarmsPerAccount)
      result.alarmsPerAccount[account] = new WorkerBeeIterable(result.alarmsPerAccount[account]);

    return result;
  }
}
