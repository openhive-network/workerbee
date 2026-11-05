import { ChangeRecoveryInProgressClassifier } from "../../classifiers";
import { IAccountChangingRecovery } from "../../classifiers/change-recovery-in-progress-classifier";
import { TCollectorEvaluationContext } from "../../factories/data-evaluation-context";
import { CollectorBase, TAvailableClassifiers } from "../collector-base";


const MAX_CHANGE_RECOVERY_GET_LIMIT = 1000;

export class ChangeRecoveryInProgressCollector extends CollectorBase<ChangeRecoveryInProgressClassifier> {
  private readonly changeRecoveryAccounts: Record<string, number> = {};

  protected pushOptions(data: ChangeRecoveryInProgressClassifier["optionsType"]): void {
    this.changeRecoveryAccounts[data.changeRecoveryAccount] = (this.changeRecoveryAccounts[data.changeRecoveryAccount] || 0) + 1;
  }

  protected popOptions(data: ChangeRecoveryInProgressClassifier["optionsType"]): void {
    this.changeRecoveryAccounts[data.changeRecoveryAccount] = (this.changeRecoveryAccounts[data.changeRecoveryAccount] || 1) - 1;

    if (this.changeRecoveryAccounts[data.changeRecoveryAccount] === 0)
      delete this.changeRecoveryAccounts[data.changeRecoveryAccount];
  }

  public async get(data: TCollectorEvaluationContext) {
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
      /*
       * Instruct TypeScript typings that ChangeRecoveryInProgressClassifier.name is actualy a Classifier name we expect.
       * This is required for the bundlers to properly deduce the type of the classifier in data evaluation context.
       */
      [ChangeRecoveryInProgressClassifier.name as "ChangeRecoveryInProgressClassifier"]: {
        recoveringAccounts: retrieveChangeRecoveryAccounts
      } as TAvailableClassifiers["ChangeRecoveryInProgressClassifier"]
    } satisfies Partial<TAvailableClassifiers>;
  };
}
