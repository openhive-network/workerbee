import { BlockHeaderClassifier } from "../../classifiers";
import { TRegisterEvaluationContext } from "../../classifiers/collector-classifier-base";
import { DynamicGlobalPropertiesClassifier } from "../../classifiers/dynamic-global-properties-classifier";
import { TCollectorEvaluationContext } from "../../factories/data-evaluation-context";
import { CollectorBase, TAvailableClassifiers } from "../collector-base";

export class BlockHeaderCollector extends CollectorBase<BlockHeaderClassifier> {
  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [DynamicGlobalPropertiesClassifier];
  }

  public async get(data: TCollectorEvaluationContext) {
    const { headBlockNumber, currentWitness, headBlockTime, headBlockId } = await data.get(DynamicGlobalPropertiesClassifier);

    return {
      /*
       * Instruct TypeScript typings that BlockHeaderClassifier.name is actualy a Classifier name we expect.
       * This is required for the bundlers to properly deduce the type of the classifier in data evaluation context.
       */
      [BlockHeaderClassifier.name as "BlockHeaderClassifier"]: {
        number: headBlockNumber,
        timestamp: headBlockTime,
        witness: currentWitness,
        id: headBlockId
      } as TAvailableClassifiers["BlockHeaderClassifier"]
    };
  };
}
