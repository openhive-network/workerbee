import { BlockHeaderClassifier } from "../classifiers/block-header-classifier";
import type { IBlockHeaderData } from "../classifiers/block-header-classifier";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { TProviderEvaluationContext } from "../factories/data-evaluation-context";
import { ProviderBase } from "./provider-base";

export interface IBlockHeaderProviderData {
  block: IBlockHeaderData;
};

export class BlockHeaderProvider extends ProviderBase {
  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      BlockHeaderClassifier
    ]
  }

  public async provide(data: TProviderEvaluationContext): Promise<IBlockHeaderProviderData> {
    const blockHeader = await data.get(BlockHeaderClassifier);

    return {
      block: {
        ...blockHeader
      }
    };
  }
}
