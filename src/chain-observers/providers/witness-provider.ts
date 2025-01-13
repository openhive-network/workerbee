import { TAccountName } from "@hiveio/wax";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { IWitness, WitnessClassifier } from "../classifiers/witness-classifier";
import { DataEvaluationContext } from "../factories/data-evaluation-context";
import { ProviderBase } from "./provider-base";

export type TWitnessProvider<TAccounts extends Array<TAccountName>> = {
  [K in TAccounts[number]]: IWitness;
};

export interface IWitnessProviderData<TAccounts extends Array<TAccountName>> {
  witnesses: TWitnessProvider<TAccounts>;
};

export interface IWitnessProviderOptions {
  accounts: string[];
}

export class WitnessProvider<TAccounts extends Array<TAccountName> = Array<TAccountName>> extends ProviderBase<IWitnessProviderOptions> {
  public readonly witnesses: string[] = [];

  public pushOptions(options: IWitnessProviderOptions): void {
    this.witnesses.push(...options.accounts);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return this.witnesses.map(witness => WitnessClassifier.forOptions({
      witness
    }));
  }

  public async provide(data: DataEvaluationContext): Promise<IWitnessProviderData<TAccounts>> {
    const result = {
      witnesses: {}
    };

    const { witnesses } = await data.get(WitnessClassifier);
    for(const witness of this.witnesses)
      result.witnesses[witness] = witnesses[witness];

    return result as IWitnessProviderData<TAccounts>;
  }
}
