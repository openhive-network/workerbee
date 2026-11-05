import { EManabarType } from "@hiveio/wax";
import { ManabarClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { TFilterEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class AccountFullManabarFilter extends FilterBase {
  private readonly manabarType: EManabarType;
  private readonly manabarLoadPercent: number;

  public constructor(
    accounts: string[],
    manabarType: EManabarType,
    manabarLoadPercent: number = 98
  ) {
    super();

    this.manabarType = manabarType;
    this.manabarLoadPercent = manabarLoadPercent;

    this.accounts = new Set(accounts);
  }

  public readonly accounts: Set<string>;

  public usedContexts(): Array<TRegisterEvaluationContext> {
    const context: TRegisterEvaluationContext[] = [];

    for(const account of this.accounts)
      context.push(ManabarClassifier.forOptions({
        account,
        manabarType: this.manabarType
      }));

    return context;
  }

  public async match(data: TFilterEvaluationContext): Promise<boolean> {
    const { manabarData } = await data.get(ManabarClassifier);

    for(const account of this.accounts) {
      const manabar = manabarData[account]?.[this.manabarType];

      if (manabar === undefined)
        continue;

      if (manabar.max === 0n)
        return true;

      if(manabar.percent >= this.manabarLoadPercent)
        return true;
    }

    return false;
  }
}
