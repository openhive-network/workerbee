import { EManabarType } from "@hiveio/wax";
import type { WorkerBee } from "../../bot";
import { ManabarClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { IManabarCollectorOptions } from "../collectors/common/manabar-collector";
import type { DataEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class AccountFullManabarFilter extends FilterBase {
  public constructor(
    worker: WorkerBee,
    private readonly account: string,
    private readonly manabarType: EManabarType,
    private readonly manabarLoadPercent: number = 98
  ) {
    super(worker);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      ManabarClassifier.forOptions({
        account: this.account,
        manabarType: this.manabarType
      } as IManabarCollectorOptions)
    ];
  }

  public async match(data: DataEvaluationContext): Promise<boolean> {
    const { manabarData } = await data.get(ManabarClassifier);

    const manabar = manabarData[this.account]?.[this.manabarType];

    if (manabar === undefined)
      return false;

    return manabar.percent >= this.manabarLoadPercent;
  }
}
