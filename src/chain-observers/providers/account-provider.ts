import { TAccountName } from "@hiveio/wax";
import { AccountClassifier } from "../classifiers";
import { IAccount } from "../classifiers/account-classifier";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { DataEvaluationContext } from "../factories/data-evaluation-context";
import { ProviderBase } from "./provider-base";

export type TAccountProvided<TAccounts extends Array<TAccountName>> = {
  [K in TAccounts[number]]: IAccount;
};

export interface IAccountProviderData<TAccounts extends Array<TAccountName>> {
  accounts: TAccountProvided<TAccounts>;
};

export class AccountProvider<TAccounts extends Array<TAccountName> = Array<TAccountName>> extends ProviderBase {
  public constructor(
    private readonly accounts: TAccounts
  ) {
    super();
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return this.accounts.map(account => AccountClassifier.forOptions({
      account
    }));
  }

  public async provide(data: DataEvaluationContext): Promise<IAccountProviderData<TAccounts>> {
    const result = {
      accounts: {}
    };

    const accounts = await data.get(AccountClassifier);
    for(const account of this.accounts)
      result.accounts[account] = accounts.accounts[account];

    return result as IAccountProviderData<TAccounts>;
  }
}
