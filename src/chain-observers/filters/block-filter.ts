import { BlockHeaderClassifier } from "../classifiers/block-header-classifier";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { TFilterEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class BlockNumberFilter extends FilterBase {
  public constructor(
    private readonly number: number
  ) {
    super();
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      BlockHeaderClassifier
    ];
  }

  public async match(data: TFilterEvaluationContext): Promise<boolean> {
    const block = await data.get(BlockHeaderClassifier);

    return block.number === this.number;
  }
}
