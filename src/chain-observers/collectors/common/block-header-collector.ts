import { BlockHeaderClassifier } from "../../classifiers";
import { TRegisterEvaluationContext } from "../../classifiers/collector-classifier-base";
import { DynamicGlobalPropertiesClassifier } from "../../classifiers/dynamic-global-properties-classifier";
import { DataEvaluationContext } from "../../factories/data-evaluation-context";
import { CollectorBase, TAvailableClassifiers } from "../collector-base";

export class BlockHeaderCollector extends CollectorBase {
  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [DynamicGlobalPropertiesClassifier];
  }

  public async fetchData(data: DataEvaluationContext) {
    const { headBlockNumber, currentWitness, headBlockTime, headBlockId } = await data.get(DynamicGlobalPropertiesClassifier);

    return {
      [BlockHeaderClassifier.name]: {
        number: headBlockNumber,
        timestamp: headBlockTime,
        witness: currentWitness,
        id: headBlockId
      } as TAvailableClassifiers["BlockHeaderClassifier"]
    } satisfies Partial<TAvailableClassifiers>;
  };
}
