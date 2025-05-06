import Long from "long";
import { RcAccountClassifier } from "../../classifiers";
import { IRcAccount } from "../../classifiers/rc-account-classifier";
import { DataEvaluationContext } from "../../factories/data-evaluation-context";
import { CollectorBase, TAvailableClassifiers } from "../collector-base";

export interface IRcAccountCollectorOptions {
  rcAccount: string;
}

const MAX_RC_ACCOUNT_GET_LIMIT = 100;

export class RcAccountCollector extends CollectorBase {
  private readonly rcAccounts: Record<string, number> = {};

  protected pushOptions(data: IRcAccountCollectorOptions): void {
    this.rcAccounts[data.rcAccount] = (this.rcAccounts[data.rcAccount] || 0) + 1;
  }

  protected popOptions(data: IRcAccountCollectorOptions): void {
    this.rcAccounts[data.rcAccount] = (this.rcAccounts[data.rcAccount] || 1) - 1;

    if (this.rcAccounts[data.rcAccount] === 0)
      delete this.rcAccounts[data.rcAccount];
  }

  public async fetchData(_: DataEvaluationContext) {
    const rcAccounts: Record<string, IRcAccount> = {};

    const accountNames = Object.keys(this.rcAccounts);
    for (let i = 0; i < accountNames.length; i += MAX_RC_ACCOUNT_GET_LIMIT) {
      const chunk = accountNames.slice(i, i + MAX_RC_ACCOUNT_GET_LIMIT);

      const { rc_accounts: apiRcAccounts } = await this.worker.chain!.api.rc_api.find_rc_accounts({ accounts: chunk });

      for(const rcAccount of apiRcAccounts)
        rcAccounts[rcAccount.account] = {
          name: rcAccount.account,
          rcManabar: {
            currentMana: Long.fromValue(rcAccount.rc_manabar.current_mana),
            max: Long.fromValue(rcAccount.max_rc),
            lastUpdateTime: new Date(rcAccount.rc_manabar.last_update_time * 1000)
          }
        };
    }

    return {
      [RcAccountClassifier.name]: {
        rcAccounts
      } as TAvailableClassifiers["RcAccountClassifier"]
    } satisfies Partial<TAvailableClassifiers>;
  };
}
