import { TAccountName } from "@hiveio/wax";
import { AccountClassifier, ChangeRecoveryInProgressClassifier, DeclineVotingRightsClassifier } from "../classifiers";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { DataEvaluationContext } from "../factories/data-evaluation-context";
import { ONE_MONTH_MS, STEEM_ACCOUNT_NAME } from "../filters/alarm-filter";
import { ProviderBase } from "./provider-base";

export enum EAlarmType {
  LEGACY_RECOVERY_ACCOUNT_SET,
  GOVERNANCE_VOTE_EXPIRATION_SOON,
  GOVERNANCE_VOTE_EXPIRED,
  RECOVERY_ACCOUNT_IS_CHANGING,
  DECLINING_VOTING_RIGHTS
}

export type TAlarmAccounts<TAccounts extends Array<TAccountName>> = {
  [K in TAccounts[number]]: EAlarmType[];
};

export interface IAlarmAccountsData<TAccounts extends Array<TAccountName>> {
  alarmsPerAccount: TAlarmAccounts<TAccounts>;
};

export class AlarmProvider<TAccounts extends Array<TAccountName> = Array<TAccountName>> extends ProviderBase {
  public constructor(
    private readonly accounts: TAccounts
  ) {
    super();
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      ...this.accounts.map(account => AccountClassifier.forOptions({
        account
      })),
      ...this.accounts.map(account => ChangeRecoveryInProgressClassifier.forOptions({
        changeRecoveryAccount: account
      })),
      ...this.accounts.map(account => DeclineVotingRightsClassifier.forOptions({
        declineVotingRightsAccount: account
      }))
    ];
  }

  public async provide(data: DataEvaluationContext): Promise<IAlarmAccountsData<TAccounts>> {
    const result: IAlarmAccountsData<TAccounts> = {
      alarmsPerAccount: this.accounts.reduce((prev, curr) => {
        prev[curr]  = [];

        return prev;
      }, {} as TAlarmAccounts<TAccounts>)
    };

    const { accounts } = await data.get(AccountClassifier);
    for(const account of this.accounts) {
      if (accounts[account].recoveryAccount === STEEM_ACCOUNT_NAME)
        result.alarmsPerAccount[account].push(EAlarmType.LEGACY_RECOVERY_ACCOUNT_SET);

      if (accounts[account].governanceVoteExpiration === undefined)
        result.alarmsPerAccount[account].push(EAlarmType.GOVERNANCE_VOTE_EXPIRED);
      else if (accounts[account].governanceVoteExpiration!.getTime() < (Date.now() + ONE_MONTH_MS))
        result.alarmsPerAccount[account].push(EAlarmType.GOVERNANCE_VOTE_EXPIRATION_SOON);
    }

    const { recoveringAccounts } = await data.get(ChangeRecoveryInProgressClassifier);

    for(const account of this.accounts)
      if (recoveringAccounts[account])
        result.alarmsPerAccount[account].push(EAlarmType.RECOVERY_ACCOUNT_IS_CHANGING);


    const { declineVotingRightsAccounts } = await data.get(DeclineVotingRightsClassifier);

    for(const account of this.accounts)
      if (declineVotingRightsAccounts[account])
        result.alarmsPerAccount[account].push(EAlarmType.DECLINING_VOTING_RIGHTS);


    return result;
  }
}
