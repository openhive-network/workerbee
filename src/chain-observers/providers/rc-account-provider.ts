import { TAccountName } from "@hiveio/wax";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { IRcAccount, RcAccountClassifier } from "../classifiers/rc-account-classifier";
import { DataEvaluationContext } from "../factories/data-evaluation-context";
import { ProviderBase } from "./provider-base";

export type TRcAccountProvided<TAccounts extends Array<TAccountName>> = {
  [K in TAccounts[number]]: IRcAccount;
};

export interface IRcAccountProviderData<TAccounts extends Array<TAccountName>> {
  rcAccounts: TRcAccountProvided<TAccounts>;
};

export interface IRcAccountsProviderOptions {
  accounts: string[];
}

export class RcAccountProvider<TAccounts extends Array<TAccountName> = Array<TAccountName>> extends ProviderBase<IRcAccountsProviderOptions> {
  public readonly rcAccounts: string[] = [];

  public pushOptions(options: IRcAccountsProviderOptions): void {
    this.rcAccounts.push(...options.accounts);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return this.rcAccounts.map(rcAccount => RcAccountClassifier.forOptions({
      rcAccount
    }));
  }

  public async provide(data: DataEvaluationContext): Promise<IRcAccountProviderData<TAccounts>> {
    const result = {
      rcAccounts: {}
    };

    const rcAccounts = await data.get(RcAccountClassifier);
    for(const rcAccount of this.rcAccounts)
      result.rcAccounts[rcAccount] = rcAccounts.rcAccounts[rcAccount];

    return result as IRcAccountProviderData<TAccounts>;
  }
}
