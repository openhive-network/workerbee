import { BlockHeaderClassifier } from "../classifiers/block-header-classifier";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { TFilterEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class BlockChangedFilter extends FilterBase {
  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      BlockHeaderClassifier
    ];
  }

  private previousBlock?: number;

  public async match(data: TFilterEvaluationContext): Promise<boolean> {
    const block = await data.get(BlockHeaderClassifier);

    const blockChanged = this.previousBlock !== block.number;

    this.previousBlock = block.number;

    return blockChanged;
  }
}
