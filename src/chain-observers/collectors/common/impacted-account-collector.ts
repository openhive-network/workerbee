import { OperationClassifier } from "../../classifiers";
import { TRegisterEvaluationContext } from "../../classifiers/collector-classifier-base";
import { IImpactedAccount } from "../../classifiers/impacted-account-classifier";
import { IOperationTransactionPair } from "../../classifiers/operation-classifier";
import { DataEvaluationContext } from "../../factories/data-evaluation-context";
import { CollectorBase, TAvailableClassifiers } from "../collector-base";

export class ImpactedAccountCollector extends CollectorBase {
  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [OperationClassifier];
  }

  private ensureStructIntegrity(impactedAccounts: Record<string, IImpactedAccount>, accountName: string): Array<IOperationTransactionPair> {
    let struct = impactedAccounts[accountName];

    if (struct === undefined)
      struct = {
        name: accountName,
        operations: []
      };

    return struct.operations as IOperationTransactionPair[];
  }

  public async fetchData(data: DataEvaluationContext) {
    const { operations } = await data.get(OperationClassifier);

    const impactedAccounts: Record<string, IImpactedAccount> = {};

    for(const operation of operations) {
      const impactedOperationAccounts = this.worker.chain!.operationGetImpactedAccounts(operation.operation);

      for(const accountName of impactedOperationAccounts)
        this.ensureStructIntegrity(impactedAccounts, accountName).push(operation);
    }

    return {
      ImpactedAccountClassifier: {
        impactedAccounts
      }
    } satisfies Partial<TAvailableClassifiers>;
  };
}
