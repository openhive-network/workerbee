import { TAccountName } from "@hiveio/wax";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { IRcAccount, RcAccountClassifier } from "../classifiers/rc-account-classifier";
import { DataEvaluationContext } from "../factories/data-evaluation-context";
import { ProviderBase } from "./provider-base";

export type TRcAccountProvided<TAccounts extends Array<TAccountName>> = {
  [K in TAccounts[number]]: IRcAccount;
};

export interface IAccountProviderData<TAccounts extends Array<TAccountName>> {
  rcAccounts: TRcAccountProvided<TAccounts>;
};

export class RcAccountProvider<TAccounts extends Array<TAccountName> = Array<TAccountName>> extends ProviderBase {
  public constructor(
    private readonly rcAccounts: TAccounts
  ) {
    super();
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return this.rcAccounts.map(rcAccount => RcAccountClassifier.forOptions({
      rcAccount
    }));
  }

  public async provide(data: DataEvaluationContext): Promise<IAccountProviderData<TAccounts>> {
    const result = {
      rcAccounts: {}
    };

    const rcAccounts = await data.get(RcAccountClassifier);
    for(const rcAccount of this.rcAccounts)
      result.rcAccounts[rcAccount] = rcAccounts.rcAccounts[rcAccount];

    return result as IAccountProviderData<TAccounts>;
  }
}
