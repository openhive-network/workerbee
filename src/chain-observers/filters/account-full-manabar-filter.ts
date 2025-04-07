import { EManabarType } from "@hiveio/wax";
import Long from "long";
import type { WorkerBee } from "../../bot";
import { AccountClassifier, DynamicGlobalPropertiesClassifier, RcAccountClassifier } from "../classifiers";
import { IManabarData } from "../classifiers/account-classifier";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { IAccountCollectorOptions } from "../collectors/jsonrpc/account-collector";
import { IRcAccountCollectorOptions } from "../collectors/jsonrpc/rc-account-collector";
import type { DataEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

const PERCENT_VALUE_DOUBLE_PRECISION = 100;
export const ONE_HUNDRED_PERCENT = 100 * PERCENT_VALUE_DOUBLE_PRECISION;

export class AccountFullManabarFilter extends FilterBase {
  public constructor(
    worker: WorkerBee,
    private readonly account: string,
    private readonly manabarType: EManabarType
  ) {
    super(worker);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      DynamicGlobalPropertiesClassifier,
      (
        this.manabarType === EManabarType.RC
          ? RcAccountClassifier.forOptions({ rcAccount: this.account } satisfies IRcAccountCollectorOptions)
          : AccountClassifier.forOptions({ account: this.account } satisfies IAccountCollectorOptions)
      )
    ];
  }

  public async match(data: DataEvaluationContext): Promise<boolean> {
    const dgpo = await data.get(DynamicGlobalPropertiesClassifier);
    const time = Math.round(dgpo.headBlockTime.getTime() / 1000);

    let manabar: IManabarData;
    let max: Long;

    if(this.manabarType === EManabarType.RC) {
      const rcAccountClassifier = await data.get(RcAccountClassifier);
      const rcAccount = rcAccountClassifier.rcAccounts[this.account];
      if(!rcAccount)
        return false;

      manabar = rcAccount.rcManabar;
      max = manabar.max;
    } else {
      const accountClassifier = await data.get(AccountClassifier);
      const account = accountClassifier.accounts[this.account];
      if(!account)
        return false;

      manabar = this.manabarType === EManabarType.UPVOTE ? account.upvoteManabar : account.downvoteManabar;
      max = manabar.max;

      if(this.manabarType === EManabarType.DOWNVOTE)
        if(max.divide(ONE_HUNDRED_PERCENT).greaterThan(ONE_HUNDRED_PERCENT))
          max = max.divide(ONE_HUNDRED_PERCENT).multiply(dgpo.downvotePoolPercent);
        else
          max = max.multiply(dgpo.downvotePoolPercent).divide(ONE_HUNDRED_PERCENT);
    }

    const manabarData = this.worker.chain!.calculateCurrentManabarValue(
      time,
      max,
      manabar.currentMana,
      manabar.lastUpdateTime.getTime() / 1000
    );

    return manabarData.percent >= 98;
  }
}
