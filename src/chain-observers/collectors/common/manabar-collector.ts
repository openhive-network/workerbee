import { EManabarType, TAccountName } from "@hiveio/wax";
import { WorkerBeeError } from "../../../errors";
import { AccountClassifier, RcAccountClassifier } from "../../classifiers";
import { TRegisterEvaluationContext } from "../../classifiers/collector-classifier-base";
import { DynamicGlobalPropertiesClassifier } from "../../classifiers/dynamic-global-properties-classifier";
import { TManabars } from "../../classifiers/manabar-classifier";
import { DataEvaluationContext } from "../../factories/data-evaluation-context";
import { CollectorBase, TAvailableClassifiers } from "../collector-base";
import { IAccountCollectorOptions } from "../jsonrpc/account-collector";
import { IRcAccountCollectorOptions } from "../jsonrpc/rc-account-collector";

export interface IManabarCollectorOptions {
  account: TAccountName;
  manabarType: EManabarType;
}

const PERCENT_VALUE_DOUBLE_PRECISION = 100;
export const ONE_HUNDRED_PERCENT = 100 * PERCENT_VALUE_DOUBLE_PRECISION;

export class ManabarCollector extends CollectorBase {
  private readonly upvoteManabarAccounts = new Map<TAccountName, number>();
  private readonly downvoteManabarAccounts = new Map<TAccountName, number>();
  private readonly rcManabarAccounts = new Map<TAccountName, number>();

  private selectOptionsContainer(type: EManabarType): Map<TAccountName, number> {
    switch(type) {
    case EManabarType.UPVOTE:
      return this.upvoteManabarAccounts;
    case EManabarType.DOWNVOTE:
      return this.downvoteManabarAccounts;
    case EManabarType.RC:
      return this.rcManabarAccounts;
    default:
      throw new WorkerBeeError(`Unsupported manabar type: ${type}`);
    }
  };

  protected pushOptions(data: IManabarCollectorOptions): void {
    const manabarObject: Map<TAccountName, number> = this.selectOptionsContainer(data.manabarType);

    const accountData = manabarObject.get(data.account);
    if(accountData)
      manabarObject.set(data.account, accountData + 1);
    else
      manabarObject.set(data.account, 1);
  }

  protected popOptions(data: IManabarCollectorOptions): void {
    const manabarObject: Map<TAccountName, number> = this.selectOptionsContainer(data.manabarType);

    const accountData = manabarObject.get(data.account);
    if(accountData && accountData > 1)
      manabarObject.set(data.account, accountData - 1);
    else
      manabarObject.delete(data.account);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    const classifiers: TRegisterEvaluationContext[] = [DynamicGlobalPropertiesClassifier];
    for(const [account] of this.upvoteManabarAccounts)
      classifiers.push(AccountClassifier.forOptions({ account } satisfies IAccountCollectorOptions));
    for(const [account] of this.downvoteManabarAccounts)
      classifiers.push(AccountClassifier.forOptions({ account } satisfies IAccountCollectorOptions));
    for(const [rcAccount] of this.rcManabarAccounts)
      classifiers.push(RcAccountClassifier.forOptions({ rcAccount } satisfies IRcAccountCollectorOptions));

    return classifiers;
  }

  public async fetchData(data: DataEvaluationContext) {
    const dgpo = await data.get(DynamicGlobalPropertiesClassifier);
    const time = Math.round(dgpo.headBlockTime.getTime() / 1000);

    const manabarData: Record<string, TManabars> = {};

    if (this.rcManabarAccounts.size > 0) {
      const rcAccounts = await data.get(RcAccountClassifier);
      for (const [account] of this.rcManabarAccounts) {
        if(!rcAccounts.rcAccounts[account])
          continue;

        if (manabarData[account] === undefined)
          manabarData[account] = {};

        const startManabarData = Date.now();

        const calculatedManabarData = this.worker.chain!.calculateCurrentManabarValue(
          time,
          rcAccounts.rcAccounts[account].rcManabar.max,
          rcAccounts.rcAccounts[account].rcManabar.currentMana,
          rcAccounts.rcAccounts[account].rcManabar.lastUpdateTime.getTime() / 1000
        );

        data.addTiming("calculateCurrentManabarValue", Date.now() - startManabarData);

        manabarData[account][EManabarType.RC] = {
          currentMana: calculatedManabarData.current,
          lastUpdateTime: rcAccounts.rcAccounts[account].rcManabar.lastUpdateTime,
          max: calculatedManabarData.max,
          percent: calculatedManabarData.percent
        };
      }
    }

    if (this.downvoteManabarAccounts.size > 0 || this.upvoteManabarAccounts.size > 0) {
      const accounts = await data.get(AccountClassifier);
      for (const [account] of this.upvoteManabarAccounts) {
        if(!accounts.accounts[account])
          continue;

        if (manabarData[account] === undefined)
          manabarData[account] = {};

        const startManabarData = Date.now();

        const calculatedManabarData = this.worker.chain!.calculateCurrentManabarValue(
          time,
          accounts.accounts[account].upvoteManabar.max,
          accounts.accounts[account].upvoteManabar.currentMana,
          accounts.accounts[account].upvoteManabar.lastUpdateTime.getTime() / 1000
        );

        data.addTiming("calculateCurrentManabarValue", Date.now() - startManabarData);

        manabarData[account][EManabarType.UPVOTE] = {
          currentMana: calculatedManabarData.current,
          lastUpdateTime: accounts.accounts[account].upvoteManabar.lastUpdateTime,
          max: calculatedManabarData.max,
          percent: calculatedManabarData.percent
        };
      }

      for (const [account] of this.downvoteManabarAccounts) {
        if(!accounts.accounts[account])
          continue;

        if (manabarData[account] === undefined)
          manabarData[account] = {};

        const startManabarData = Date.now();

        let max = accounts.accounts[account].upvoteManabar.max;

        if(max.divide(ONE_HUNDRED_PERCENT).greaterThan(ONE_HUNDRED_PERCENT))
          max = max.divide(ONE_HUNDRED_PERCENT).multiply(dgpo.downvotePoolPercent);
        else
          max = max.multiply(dgpo.downvotePoolPercent).divide(ONE_HUNDRED_PERCENT);

        const calculatedManabarData = this.worker.chain!.calculateCurrentManabarValue(
          time,
          max,
          accounts.accounts[account].downvoteManabar.currentMana,
          accounts.accounts[account].downvoteManabar.lastUpdateTime.getTime() / 1000
        );

        data.addTiming("calculateCurrentManabarValue", Date.now() - startManabarData);

        manabarData[account][EManabarType.UPVOTE] = {
          currentMana: calculatedManabarData.current,
          lastUpdateTime: accounts.accounts[account].downvoteManabar.lastUpdateTime,
          max: calculatedManabarData.max,
          percent: calculatedManabarData.percent
        };
      }
    }

    return {
      ManabarClassifier: {
        manabarData
      }
    } satisfies Partial<TAvailableClassifiers>;
  };
}
