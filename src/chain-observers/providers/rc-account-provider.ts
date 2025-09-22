import { TAccountName } from "@hiveio/wax";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { IRcAccount, RcAccountClassifier } from "../classifiers/rc-account-classifier";
import { TProviderEvaluationContext } from "../factories/data-evaluation-context";
import { ProviderBase } from "./provider-base";

export type TRcAccountProvided<TAccounts extends Array<TAccountName>> = {
  [K in TAccounts[number]]: IRcAccount;
};

export interface IRcAccountProviderData<TAccounts extends Array<TAccountName>> {
  rcAccounts: Partial<TRcAccountProvided<TAccounts>>;
};

export interface IRcAccountsProviderOptions {
  accounts: string[];
}

export class RcAccountProvider<
  TAccounts extends Array<TAccountName> = Array<TAccountName>
> extends ProviderBase<IRcAccountsProviderOptions, IRcAccountProviderData<TAccounts>> {
  public readonly rcAccounts = new Set<TAccountName>();

  public pushOptions(options: IRcAccountsProviderOptions): void {
    for(const account of options.accounts)
      this.rcAccounts.add(account);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    const classifiers: Array<TRegisterEvaluationContext> = [];
    for(const rcAccount of this.rcAccounts)
      classifiers.push(RcAccountClassifier.forOptions({ rcAccount }));

    return classifiers;
  }

  public get baseStructure(): IRcAccountProviderData<TAccounts> {
    return {
      rcAccounts: {}
    };
  }

  public async provide(data: TProviderEvaluationContext): Promise<IRcAccountProviderData<TAccounts>> {
    const result = this.baseStructure;

    const rcAccounts = await data.get(RcAccountClassifier);
    for(const rcAccount of this.rcAccounts)
      result.rcAccounts[rcAccount] = rcAccounts.rcAccounts[rcAccount];

    return result as IRcAccountProviderData<TAccounts>;
  }
}
