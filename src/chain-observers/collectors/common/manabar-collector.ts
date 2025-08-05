import { EManabarType, TAccountName } from "@hiveio/wax";
import { WorkerBeeError } from "../../../errors";
import { AccountClassifier, RcAccountClassifier, ManabarClassifier } from "../../classifiers";
import { TRegisterEvaluationContext } from "../../classifiers/collector-classifier-base";
import { DynamicGlobalPropertiesClassifier } from "../../classifiers/dynamic-global-properties-classifier";
import { TManabars } from "../../classifiers/manabar-classifier";
import { TCollectorEvaluationContext } from "../../factories/data-evaluation-context";
import { CollectorBase, TAvailableClassifiers } from "../collector-base";

const PERCENT_VALUE_DOUBLE_PRECISION = 100;
export const ONE_HUNDRED_PERCENT = 100 * PERCENT_VALUE_DOUBLE_PRECISION;

export class ManabarCollector extends CollectorBase<ManabarClassifier> {
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

  protected pushOptions(data: ManabarClassifier["optionsType"]): void {
    const manabarObject: Map<TAccountName, number> = this.selectOptionsContainer(data.manabarType);

    const accountData = manabarObject.get(data.account);
    if(accountData)
      manabarObject.set(data.account, accountData + 1);
    else
      manabarObject.set(data.account, 1);
  }

  protected popOptions(data: ManabarClassifier["optionsType"]): void {
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
      classifiers.push(AccountClassifier.forOptions({ account }));
    for(const [account] of this.downvoteManabarAccounts)
      classifiers.push(AccountClassifier.forOptions({ account }));
    for(const [rcAccount] of this.rcManabarAccounts)
      classifiers.push(RcAccountClassifier.forOptions({ rcAccount }));

    return classifiers;
  }

  public async get(data: TCollectorEvaluationContext) {
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

        if((max / BigInt(ONE_HUNDRED_PERCENT)) > BigInt(ONE_HUNDRED_PERCENT))
          max = (max / BigInt(ONE_HUNDRED_PERCENT)) * BigInt(dgpo.downvotePoolPercent);
        else
          max = max * BigInt(dgpo.downvotePoolPercent) / BigInt(ONE_HUNDRED_PERCENT);

        const calculatedManabarData = this.worker.chain!.calculateCurrentManabarValue(
          time,
          max,
          accounts.accounts[account].downvoteManabar.currentMana,
          accounts.accounts[account].downvoteManabar.lastUpdateTime.getTime() / 1000
        );

        data.addTiming("calculateCurrentManabarValue", Date.now() - startManabarData);

        manabarData[account][EManabarType.DOWNVOTE] = {
          currentMana: calculatedManabarData.current,
          lastUpdateTime: accounts.accounts[account].downvoteManabar.lastUpdateTime,
          max: calculatedManabarData.max,
          percent: calculatedManabarData.percent
        };
      }
    }

    return {
      /*
       * Instruct TypeScript typings that ManabarClassifier.name is actualy a Classifier name we expect.
       * This is required for the bundlers to properly deduce the type of the classifier in data evaluation context.
       */
      [ManabarClassifier.name as "ManabarClassifier"]: {
        manabarData
      } as TAvailableClassifiers["ManabarClassifier"]
    };
  };
}
