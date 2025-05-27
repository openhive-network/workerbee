import { CollectorClassifierBase, TRegisterEvaluationContext } from "./collector-classifier-base";

export interface IDeclinedVotingRightsAccount {
  account: string;
  effectiveDate: Date;
}

export interface IDeclineVotingRightsAccountsData {
  declineVotingRightsAccounts: Record<string, IDeclinedVotingRightsAccount>;
}

export interface IDeclineVotingRightsCollectorOptions {
  declineVotingRightsAccount: string;
}

export class DeclineVotingRightsClassifier extends CollectorClassifierBase<IDeclineVotingRightsAccountsData, void, void, IDeclineVotingRightsCollectorOptions> {
  public static forOptions(options: IDeclineVotingRightsCollectorOptions): TRegisterEvaluationContext {
    return {
      class: this, // Intentionally using `this` to refer to the class prototype itself later - even though it is not a class **instance**
      options
    };
  }
}
