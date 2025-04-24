import { IDeclinedVotingRightsAccount } from "../../classifiers/decline-voting-rights-classifier";
import { DataEvaluationContext } from "../../factories/data-evaluation-context";
import { CollectorBase, TAvailableClassifiers } from "../collector-base";

export interface IDeclineVotingRightsCollectorOptions {
  declineVotingRightsAccount: string;
}

const MAX_DECLINED_VOTING_RIGHTS_GET_LIMIT = 100;

export class DeclineVotingRightsCollector extends CollectorBase {
  private readonly declineVotingRightsAccounts: Record<string, number> = {};

  protected pushOptions(data: IDeclineVotingRightsCollectorOptions): void {
    this.declineVotingRightsAccounts[data.declineVotingRightsAccount] = (this.declineVotingRightsAccounts[data.declineVotingRightsAccount] || 0) + 1;
  }

  protected popOptions(data: IDeclineVotingRightsCollectorOptions): void {
    this.declineVotingRightsAccounts[data.declineVotingRightsAccount] = (this.declineVotingRightsAccounts[data.declineVotingRightsAccount] || 1) - 1;

    if (this.declineVotingRightsAccounts[data.declineVotingRightsAccount] === 0)
      delete this.declineVotingRightsAccounts[data.declineVotingRightsAccount];
  }

  public async fetchData(data: DataEvaluationContext) {
    const declineVotingRightsAccounts: Record<string, IDeclinedVotingRightsAccount> = {};

    const recoveryAccounts = Object.keys(this.declineVotingRightsAccounts);
    for (let i = 0; i < recoveryAccounts.length; i += MAX_DECLINED_VOTING_RIGHTS_GET_LIMIT) {
      const chunk = recoveryAccounts.slice(i, i + MAX_DECLINED_VOTING_RIGHTS_GET_LIMIT);

      const startFindDeclineVotingRightsRequests = Date.now();
      const { requests } = await this.worker.chain!.api.database_api.find_decline_voting_rights_requests({ accounts: chunk });
      data.addTiming("database_api.find_decline_voting_rights_requests", Date.now() - startFindDeclineVotingRightsRequests);

      for(const request of requests)
        declineVotingRightsAccounts[request.account] = {
          account: request.account,
          effectiveDate: new Date(`${request.effective_date}Z`)
        };
    }

    return {
      DeclineVotingRightsClassifier: {
        declineVotingRightsAccounts
      }
    } satisfies Partial<TAvailableClassifiers>;
  };
}
