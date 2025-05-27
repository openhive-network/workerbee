import { BlockHeaderClassifier, DynamicGlobalPropertiesClassifier } from "../../classifiers";
import { TRegisterEvaluationContext } from "../../classifiers/collector-classifier-base";
import { DataEvaluationContext } from "../../factories/data-evaluation-context";
import { CollectorBase, TAvailableClassifiers } from "../collector-base";

export class DynamicGlobalPropertiesCollector extends CollectorBase<DynamicGlobalPropertiesClassifier> {
  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [BlockHeaderClassifier];
  }

  public async get(data: DataEvaluationContext) {
    const { id, number, timestamp, witness } = await data.get(BlockHeaderClassifier);

    return {
      /*
       * Instruct TypeScript typings that DynamicGlobalPropertiesClassifier.name is actualy a Classifier name we expect.
       * This is required for the bundlers to properly deduce the type of the classifier in data evaluation context.
       */
      [DynamicGlobalPropertiesClassifier.name as "DynamicGlobalPropertiesClassifier"]: {
        currentWitness: witness,
        downvotePoolPercent: 0,
        headBlockNumber: number,
        headBlockTime: timestamp,
        headBlockId: id
      } as TAvailableClassifiers["DynamicGlobalPropertiesClassifier"]
    };
  };
}
