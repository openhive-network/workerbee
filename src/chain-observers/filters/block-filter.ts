import type { WorkerBee } from "../../bot";
import { BlockHeaderClassifier } from "../classifiers/block-header-classifier";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { DataEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class BlockNumberFilter extends FilterBase {
  public constructor(
    worker: WorkerBee,
    private readonly number: number
  ) {
    super(worker);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      BlockHeaderClassifier
    ];
  }

  public async match(data: DataEvaluationContext): Promise<boolean> {
    const block = await data.get(BlockHeaderClassifier);

    return block.number === this.number;
  }
}
