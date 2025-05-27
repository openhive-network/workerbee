import { DynamicGlobalPropertiesClassifier } from "../../classifiers";
import { DataEvaluationContext } from "../../factories/data-evaluation-context";
import { CollectorBase, TAvailableClassifiers } from "../collector-base";

export class DynamicGlobalPropertiesCollector extends CollectorBase {
  public async get(_: DataEvaluationContext) {
    const {
      current_witness,
      head_block_number,
      time,
      downvote_pool_percent,
      head_block_id
    } = await this.worker.chain!.api.database_api.get_dynamic_global_properties({});

    return {
      [DynamicGlobalPropertiesClassifier.name]: {
        currentWitness: current_witness,
        downvotePoolPercent: downvote_pool_percent,
        headBlockNumber: head_block_number,
        headBlockTime: new Date(`${time}Z`),
        headBlockId: head_block_id
      } as TAvailableClassifiers["DynamicGlobalPropertiesClassifier"]
    } satisfies Partial<TAvailableClassifiers>;
  };
}
