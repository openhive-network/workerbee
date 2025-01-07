import { CollectorClassifierBase } from "./collector-classifier-base";

export interface IDeclinedVotingRightsAccount {
  account: string;
  effectiveDate: Date;
}

export interface IDeclineVotingRightsAccountsData {
  declineVotingRightsAccounts: Record<string, IDeclinedVotingRightsAccount>;
}

export class DeclineVotingRightsClassifier extends CollectorClassifierBase {
  public type!: IDeclineVotingRightsAccountsData;
}
