import { DynamicGlobalPropertiesClassifier } from "../../classifiers";
import { TCollectorEvaluationContext } from "../../factories/data-evaluation-context";
import { CollectorBase, TAvailableClassifiers } from "../collector-base";

export class DynamicGlobalPropertiesCollector extends CollectorBase<DynamicGlobalPropertiesClassifier> {
  public async get(_: TCollectorEvaluationContext) {
    const {
      current_witness,
      head_block_number,
      time,
      downvote_pool_percent,
      head_block_id
    } = await this.worker.chain!.api.database_api.get_dynamic_global_properties({});

    return {
      /*
       * Instruct TypeScript typings that DynamicGlobalPropertiesClassifier.name is actualy a Classifier name we expect.
       * This is required for the bundlers to properly deduce the type of the classifier in data evaluation context.
       */
      [DynamicGlobalPropertiesClassifier.name as "DynamicGlobalPropertiesClassifier"]: {
        currentWitness: current_witness,
        downvotePoolPercent: downvote_pool_percent,
        headBlockNumber: head_block_number,
        headBlockTime: new Date(`${time}Z`),
        headBlockId: head_block_id
      } as TAvailableClassifiers["DynamicGlobalPropertiesClassifier"]
    };
  };
}
