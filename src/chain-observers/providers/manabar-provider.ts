import { TAccountName, EManabarType } from "@hiveio/wax";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { IManabarCollectorOptions, ManabarClassifier, TManabars } from "../classifiers/manabar-classifier";
import { TProviderEvaluationContext } from "../factories/data-evaluation-context";
import { ProviderBase } from "./provider-base";

export type TManabarProvided<TAccounts extends Array<TAccountName>> = {
  [K in TAccounts[number]]: TManabars;
};

export interface IManabarProviderData<TAccounts extends Array<TAccountName>> {
  manabarData: Partial<TManabarProvided<TAccounts>>;
};

export interface IManabarProviderOptions {
  manabarData: IManabarCollectorOptions[];
}

export class ManabarProvider<
  TAccounts extends Array<TAccountName> = Array<TAccountName>
> extends ProviderBase<IManabarProviderOptions, IManabarProviderData<TAccounts>> {
  public readonly manabarData = new Map<TAccountName, Set<EManabarType>>();

  public pushOptions(options: IManabarProviderOptions): void {
    for(const { account, manabarType } of options.manabarData) {
      const singleManabarData = this.manabarData.get(account);
      if(singleManabarData)
        singleManabarData.add(manabarType);
      else
        this.manabarData.set(account, new Set([manabarType]));
    }
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    const contexts: TRegisterEvaluationContext[] = [];
    for(const [account, manabarTypes] of this.manabarData)
      for(const manabarType of manabarTypes)
        contexts.push(ManabarClassifier.forOptions({ account, manabarType }));

    return contexts;
  }

  public get baseStructure(): IManabarProviderData<TAccounts> {
    return {
      manabarData: {}
    };
  }

  public async provide(data: TProviderEvaluationContext): Promise<IManabarProviderData<TAccounts>> {
    const result = this.baseStructure;

    const { manabarData } = await data.get(ManabarClassifier);
    for(const [account, manabarTypes] of this.manabarData) {
      if (result.manabarData[account] === undefined)
        result.manabarData[account] = {};

      for(const manabarType of manabarTypes) {
        if (manabarData[account] === undefined)
          break;

        result.manabarData[account][manabarType] = manabarData[account][manabarType];
      }
    }

    return result as IManabarProviderData<TAccounts>;
  }
}
