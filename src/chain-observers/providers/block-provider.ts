import { BlockClassifier, IBlockData } from "../classifiers/block-classifier";
import { BlockHeaderClassifier, IBlockHeaderData } from "../classifiers/block-header-classifier";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { TProviderEvaluationContext } from "../factories/data-evaluation-context";
import { ProviderBase } from "./provider-base";

export interface IBlockProviderData {
  block: IBlockHeaderData & IBlockData;
};

export class BlockProvider extends ProviderBase {
  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      BlockHeaderClassifier,
      BlockClassifier
    ]
  }

  public async provide(data: TProviderEvaluationContext): Promise<IBlockProviderData> {
    const blockHeader = await data.get(BlockHeaderClassifier);
    const block = await data.get(BlockClassifier);

    return {
      block: {
        ...blockHeader,
        ...block
      }
    };
  }
}
