import { OperationClassifier, ImpactedAccountClassifier } from "../../classifiers";
import { TRegisterEvaluationContext } from "../../classifiers/collector-classifier-base";
import { IImpactedAccount } from "../../classifiers/impacted-account-classifier";
import { IOperationTransactionPair } from "../../classifiers/operation-classifier";
import { DataEvaluationContext } from "../../factories/data-evaluation-context";
import { CollectorBase, TAvailableClassifiers } from "../collector-base";

export class ImpactedAccountCollector extends CollectorBase {
  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [OperationClassifier];
  }

  public async get(data: DataEvaluationContext) {
    const { operations } = await data.get(OperationClassifier);

    const startImpactedAccounts = Date.now();

    const impactedAccounts: Record<string, IImpactedAccount> = {};

    for(const operation of operations) {
      const impactedOperationAccounts = this.worker.chain!.operationGetImpactedAccounts(operation.operation);

      for(const accountName of impactedOperationAccounts) {
        if (impactedAccounts[accountName] === undefined)
          impactedAccounts[accountName] = {
            name: accountName,
            operations: []
          };

        (impactedAccounts[accountName].operations as Array<IOperationTransactionPair>).push(operation);
      }
    }

    data.addTiming("operationGetImpactedAccounts", Date.now() - startImpactedAccounts);

    return {
      [ImpactedAccountClassifier.name]: {
        impactedAccounts
      } as TAvailableClassifiers["ImpactedAccountClassifier"]
    } satisfies Partial<TAvailableClassifiers>;
  };
}
