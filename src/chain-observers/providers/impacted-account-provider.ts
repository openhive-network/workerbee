import { TAccountName } from "@hiveio/wax";
import { WorkerBeeIterable } from "../../types/iterator";
import { ImpactedAccountClassifier } from "../classifiers";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { IOperationTransactionPair } from "../classifiers/operation-classifier";
import { DataEvaluationContext } from "../factories/data-evaluation-context";
import { ProviderBase } from "./provider-base";

export type TImpactedAccountProvided<TAccounts extends Array<TAccountName>> = {
  [K in TAccounts[number]]: WorkerBeeIterable<IOperationTransactionPair>;
};

export interface IImpactedAccountProviderData<TAccounts extends Array<TAccountName>> {
  impactedAccounts: TImpactedAccountProvided<TAccounts>;
};

export interface IImpactedAccountProviderOptions {
  accounts: string[];
}

export class ImpactedAccountProvider<TAccounts extends Array<TAccountName> = Array<TAccountName>> extends ProviderBase<IImpactedAccountProviderOptions> {
  public readonly accounts: string[] = [];

  public pushOptions(options: IImpactedAccountProviderOptions): void {
    this.accounts.push(...options.accounts);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      ImpactedAccountClassifier
    ];
  }

  public async provide(data: DataEvaluationContext): Promise<IImpactedAccountProviderData<TAccounts>> {
    const result = {
      impactedAccounts: {}
    };

    const { impactedAccounts } = await data.get(ImpactedAccountClassifier);
    for(const account of this.accounts)
      if (impactedAccounts[account] === undefined)
        result.impactedAccounts[account] = new WorkerBeeIterable<IOperationTransactionPair>([]);
      else // Copy the array to prevent the original from being modified
        result.impactedAccounts[account] = new WorkerBeeIterable<IOperationTransactionPair>(Array.from(impactedAccounts[account].operations));

    return result as IImpactedAccountProviderData<TAccounts>;
  }
}
