import type { TAccountName } from "@hiveio/wax";
import { WitnessClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { TFilterEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class WitnessMissedBlocksFilter extends FilterBase {
  readonly #witnesses: Set<TAccountName>;
  readonly #missedBlocksCountMin: number;

  public constructor(
    witnesses: TAccountName[],
    missedBlocksCountMin: number
  ) {
    super();

    this.#witnesses = new Set(witnesses);
    this.#missedBlocksCountMin = missedBlocksCountMin;
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    const classifiers: TRegisterEvaluationContext[] = [];
    for (const witness of this.#witnesses)
      classifiers.push(WitnessClassifier.forOptions({ witness }));

    return classifiers;
  }

  private initialMissedBlocksCount: number | undefined;
  private previousLastBlockNumber: number | undefined;

  public async match(data: TFilterEvaluationContext): Promise<boolean> {
    const { witnesses } = await data.get(WitnessClassifier);

    for(const witnessName of this.#witnesses) {
      const witness = witnesses[witnessName];

      // If witness is not producing blocks, we do not care about missed blocks
      if (witness === undefined)
        continue;

      if (this.previousLastBlockNumber === undefined) {
        this.initialMissedBlocksCount = witness.totalMissedBlocks;
        this.previousLastBlockNumber = witness.lastConfirmedBlockNum;

        return false;
      }

      /*
       * If witness missed more blocks than the minimum required and his last signed block number has not changed
       * (he is not producing blocks)
       */
      if (this.previousLastBlockNumber === witness.lastConfirmedBlockNum
        && this.initialMissedBlocksCount !== undefined
        && witness.totalMissedBlocks > (this.initialMissedBlocksCount + this.#missedBlocksCountMin)
      ) {
        // Reset missed blocks count to avoid multiple notifications for the same missed blocks streak
        this.initialMissedBlocksCount = undefined;

        return true;
      }

      // Update the initial missed blocks count if the last signed block number has changed - block missed streak reset
      if (this.previousLastBlockNumber !== witness.lastConfirmedBlockNum)
        this.initialMissedBlocksCount = witness.totalMissedBlocks;

      this.previousLastBlockNumber = witness.lastConfirmedBlockNum;
    }

    return false;
  }
}
