import type { WorkerBee } from "../../bot";
import { WitnessClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { DataEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class WitnessMissedBlocksFilter extends FilterBase {
  public constructor(
    worker: WorkerBee,
    private readonly witness: string,
    private readonly missedBlocksCountMin: number
  ) {
    super(worker);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      WitnessClassifier.forOptions({ witness: this.witness })
    ];
  }

  private initialMissedBlocksCount: number | undefined;
  private previousLastBlockNumber: number | undefined;

  public async match(data: DataEvaluationContext): Promise<boolean> {
    const { witnesses } = await data.get(WitnessClassifier);

    const witness = witnesses[this.witness];

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
      && witness.totalMissedBlocks > (this.initialMissedBlocksCount + this.missedBlocksCountMin)
    ) {
      // Reset missed blocks count to avoid multiple notifications for the same missed blocks streak
      this.initialMissedBlocksCount = undefined;

      return true;
    }

    // Update the initial missed blocks count if the last signed block number has changed - block missed streak reset
    if (this.previousLastBlockNumber !== witness.lastConfirmedBlockNum)
      this.initialMissedBlocksCount = witness.totalMissedBlocks;

    this.previousLastBlockNumber = witness.lastConfirmedBlockNum;

    return false;
  }
}
