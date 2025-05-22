import { ChangeRecoveryInProgressClassifier } from "../../classifiers";
import { IAccountChangingRecovery } from "../../classifiers/change-recovery-in-progress-classifier";
import { DataEvaluationContext } from "../../factories/data-evaluation-context";
import { CollectorBase, TAvailableClassifiers } from "../collector-base";

export interface IChangeRecoveryCollectorOptions {
  changeRecoveryAccount: string;
}

const MAX_CHANGE_RECOVERY_GET_LIMIT = 1000;

export class ChangeRecoveryInProgressCollector extends CollectorBase {
  private readonly changeRecoveryAccounts: Record<string, number> = {};

  protected pushOptions(data: IChangeRecoveryCollectorOptions): void {
    this.changeRecoveryAccounts[data.changeRecoveryAccount] = (this.changeRecoveryAccounts[data.changeRecoveryAccount] || 0) + 1;
  }

  protected popOptions(data: IChangeRecoveryCollectorOptions): void {
    this.changeRecoveryAccounts[data.changeRecoveryAccount] = (this.changeRecoveryAccounts[data.changeRecoveryAccount] || 1) - 1;

    if (this.changeRecoveryAccounts[data.changeRecoveryAccount] === 0)
      delete this.changeRecoveryAccounts[data.changeRecoveryAccount];
  }

  public async fetchData(data: DataEvaluationContext) {
    const retrieveChangeRecoveryAccounts: Record<string, IAccountChangingRecovery> = {};

    const recoveryAccounts = Object.keys(this.changeRecoveryAccounts);
    for (let i = 0; i < recoveryAccounts.length; i += MAX_CHANGE_RECOVERY_GET_LIMIT) {
      const chunk = recoveryAccounts.slice(i, i + MAX_CHANGE_RECOVERY_GET_LIMIT);

      const startFindChangeRecoveryAccountRequests = Date.now();
      const { requests } = await this.worker.chain!.api.database_api.find_change_recovery_account_requests({ accounts: chunk });
      data.addTiming("database_api.find_change_recovery_account_requests", Date.now() - startFindChangeRecoveryAccountRequests);

      for(const request of requests)
        retrieveChangeRecoveryAccounts[request.account_to_recover] = {
          accountToRecover: request.account_to_recover,
          recoveryAccount: request.recovery_account,
          effectiveOn: new Date(`${request.effective_on}Z`)
        };
    }

    return {
      [ChangeRecoveryInProgressClassifier.name]: {
        recoveringAccounts: retrieveChangeRecoveryAccounts
      } as TAvailableClassifiers["ChangeRecoveryInProgressClassifier"]
    } satisfies Partial<TAvailableClassifiers>;
  };
}
