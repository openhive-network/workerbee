import { BlockHeaderClassifier } from "../../classifiers";
import { TRegisterEvaluationContext } from "../../classifiers/collector-classifier-base";
import { DataEvaluationContext } from "../../factories/data-evaluation-context";
import { CollectorBase, TAvailableClassifiers } from "../collector-base";

export class DynamicGlobalPropertiesCollector extends CollectorBase {
  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [BlockHeaderClassifier];
  }

  public async fetchData(data: DataEvaluationContext) {
    const { id, number, timestamp, witness } = await data.get(BlockHeaderClassifier);

    return {
      DynamicGlobalPropertiesClassifier: {
        currentWitness: witness,
        downvotePoolPercent: 0,
        headBlockNumber: number,
        headBlockTime: timestamp,
        headBlockId: id
      }
    } satisfies Partial<TAvailableClassifiers>;
  };
}
