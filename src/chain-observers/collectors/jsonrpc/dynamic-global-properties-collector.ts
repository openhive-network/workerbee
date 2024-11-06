import { DataEvaluationContext } from "../../factories/data-evaluation-context";
import { CollectorBase, TAvailableClassifiers } from "../collector-base";

export class DynamicGlobalPropertiesCollector extends CollectorBase {
  public async fetchData(_: DataEvaluationContext) {
    const {
      current_witness,
      head_block_number,
      time,
      head_block_id
    } = await this.worker.chain!.api.database_api.get_dynamic_global_properties({});

    return {
      DynamicGlobalPropertiesClassifier: {
        currentWitness: current_witness,
        headBlockNumber: head_block_number,
        headBlockTime: new Date(`${time}Z`),
        headBlockId: head_block_id
      }
    } satisfies Partial<TAvailableClassifiers>;
  };
}
