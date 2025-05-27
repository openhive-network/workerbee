import { EManabarType } from "@hiveio/wax";
import type { WorkerBee } from "../../bot";
import { ManabarClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { DataEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class AccountFullManabarFilter extends FilterBase {
  public constructor(
    worker: WorkerBee,
    accounts: string[],
    private readonly manabarType: EManabarType,
    private readonly manabarLoadPercent: number = 98
  ) {
    super(worker);

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

  public async match(data: DataEvaluationContext): Promise<boolean> {
    const { manabarData } = await data.get(ManabarClassifier);

    for(const account of this.accounts) {
      const manabar = manabarData[account]?.[this.manabarType];

      if (manabar === undefined)
        return false;

      if(manabar.percent >= this.manabarLoadPercent)
        return true;
    }

    return false;
  }
}
