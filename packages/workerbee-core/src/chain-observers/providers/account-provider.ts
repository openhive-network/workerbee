import { TAccountName } from "@hiveio/wax";
import { AccountClassifier } from "../classifiers";
import { IAccount } from "../classifiers/account-classifier";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { TProviderEvaluationContext } from "../factories/data-evaluation-context";
import { ProviderBase } from "./provider-base";

export type TAccountProvided<TAccounts extends Array<TAccountName>> = {
  [K in TAccounts[number]]: IAccount;
};

export interface IAccountProviderData<TAccounts extends Array<TAccountName>> {
  accounts: Partial<TAccountProvided<TAccounts>>;
};

export interface IAccountProviderOptions {
  accounts: string[];
}

export class AccountProvider<TAccounts extends Array<TAccountName> = Array<TAccountName>> extends ProviderBase<IAccountProviderOptions> {
  public readonly accounts = new Set<TAccountName>();

  public pushOptions(options: IAccountProviderOptions): void {
    for(const account of options.accounts)
      this.accounts.add(account);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    const contexts: TRegisterEvaluationContext[] = [];
    for(const account of this.accounts)
      contexts.push(AccountClassifier.forOptions({ account }));

    return contexts;
  }

  public async provide(data: TProviderEvaluationContext): Promise<IAccountProviderData<TAccounts>> {
    const result = {
      accounts: {}
    };

    const accounts = await data.get(AccountClassifier);
    for(const account of this.accounts)
      result.accounts[account] = accounts.accounts[account];

    return result as IAccountProviderData<TAccounts>;
  }
}
