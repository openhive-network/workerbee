import { TAccountName } from "@hiveio/wax";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { IWitness, WitnessClassifier } from "../classifiers/witness-classifier";
import { TProviderEvaluationContext } from "../factories/data-evaluation-context";
import { ProviderBase } from "./provider-base";

export type TWitnessProvider<TAccounts extends Array<TAccountName>> = {
  [K in TAccounts[number]]: IWitness;
};

export interface IWitnessProviderData<TAccounts extends Array<TAccountName>> {
  witnesses: Partial<TWitnessProvider<TAccounts>>;
};

export interface IWitnessProviderOptions {
  accounts: string[];
}

export class WitnessProvider<
  TAccounts extends Array<TAccountName> = Array<TAccountName>
> extends ProviderBase<IWitnessProviderOptions, IWitnessProviderData<TAccounts>> {
  public readonly witnesses = new Set<TAccountName>();

  public pushOptions(options: IWitnessProviderOptions): void {
    for(const account of options.accounts)
      this.witnesses.add(account);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    const classifiers: Array<TRegisterEvaluationContext> = [];
    for(const witness of this.witnesses)
      classifiers.push(WitnessClassifier.forOptions({ witness }));

    return classifiers;
  }

  public get baseStructure(): IWitnessProviderData<TAccounts> {
    return {
      witnesses: {}
    };
  }

  public async provide(data: TProviderEvaluationContext): Promise<IWitnessProviderData<TAccounts>> {
    const result = this.baseStructure;

    const { witnesses } = await data.get(WitnessClassifier);
    for(const witness of this.witnesses)
      result.witnesses[witness] = witnesses[witness];

    return result as IWitnessProviderData<TAccounts>;
  }
}
