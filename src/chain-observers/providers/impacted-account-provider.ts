import { TAccountName } from "@hiveio/wax";
import { WorkerBeeIterable } from "../../types/iterator";
import { ImpactedAccountClassifier } from "../classifiers";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { IOperationTransactionPair } from "../classifiers/operation-classifier";
import { TProviderEvaluationContext } from "../factories/data-evaluation-context";
import { ProviderBase } from "./provider-base";

export type TImpactedAccountProvided<TAccounts extends Array<TAccountName>> = {
  [K in TAccounts[number]]: WorkerBeeIterable<IOperationTransactionPair>;
};

export interface IImpactedAccountProviderData<TAccounts extends Array<TAccountName>> {
  impactedAccounts: Partial<TImpactedAccountProvided<TAccounts>>;
};

export interface IImpactedAccountProviderOptions {
  accounts: string[];
}

export class ImpactedAccountProvider<
  TAccounts extends Array<TAccountName> = Array<TAccountName>
> extends ProviderBase<IImpactedAccountProviderOptions, IImpactedAccountProviderData<TAccounts>> {
  public readonly accounts = new Set<TAccountName>();

  public pushOptions(options: IImpactedAccountProviderOptions): void {
    for(const account of options.accounts)
      this.accounts.add(account);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      ImpactedAccountClassifier
    ];
  }

  public get baseStructure(): IImpactedAccountProviderData<TAccounts> {
    return {
      impactedAccounts: {}
    };
  }

  public async provide(data: TProviderEvaluationContext): Promise<IImpactedAccountProviderData<TAccounts>> {
    const result = this.baseStructure;

    const { impactedAccounts } = await data.get(ImpactedAccountClassifier);
    for(const account of this.accounts)
      if (impactedAccounts[account] !== undefined)
        result.impactedAccounts[account] = new WorkerBeeIterable<IOperationTransactionPair>(Array.from(impactedAccounts[account].operations));

    return result as IImpactedAccountProviderData<TAccounts>;
  }
}
