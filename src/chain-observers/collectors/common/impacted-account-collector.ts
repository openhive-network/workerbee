import { OperationClassifier, ImpactedAccountClassifier } from "../../classifiers";
import { TRegisterEvaluationContext } from "../../classifiers/collector-classifier-base";
import { IImpactedAccount } from "../../classifiers/impacted-account-classifier";
import { IOperationTransactionPair } from "../../classifiers/operation-classifier";
import { DataEvaluationContext } from "../../factories/data-evaluation-context";
import { CollectorBase, TAvailableClassifiers } from "../collector-base";

export class ImpactedAccountCollector extends CollectorBase<ImpactedAccountClassifier> {
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
      /*
       * Instruct TypeScript typings that ImpactedAccountClassifier.name is actualy a Classifier name we expect.
       * This is required for the bundlers to properly deduce the type of the classifier in data evaluation context.
       */
      [ImpactedAccountClassifier.name as "ImpactedAccountClassifier"]: {
        impactedAccounts
      } as TAvailableClassifiers["ImpactedAccountClassifier"]
    };
  };
}
