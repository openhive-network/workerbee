import { transaction } from "@hiveio/wax";
import { WorkerBeeError } from "../../../errors";
import { DynamicGlobalPropertiesClassifier } from "../../classifiers";
import { TRegisterEvaluationContext } from "../../classifiers/collector-classifier-base";
import { DataEvaluationContext } from "../../factories/data-evaluation-context";
import { CollectorBase, TAvailableClassifiers } from "../collector-base";

export class BlockCollector extends CollectorBase {
  private currentHeadBlock = -1;

  private cachedBlockData!: TAvailableClassifiers["BlockClassifier"];

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [DynamicGlobalPropertiesClassifier];
  }

  public async fetchData(data: DataEvaluationContext) {
    const { headBlockNumber } = await data.get(DynamicGlobalPropertiesClassifier);

    if(this.currentHeadBlock === headBlockNumber)
      return {
        BlockClassifier: this.cachedBlockData
      } satisfies Partial<TAvailableClassifiers>;

    this.currentHeadBlock = headBlockNumber;

    const { block } = await this.worker.chain!.api.block_api.get_block({ block_num: headBlockNumber });

    if (block === undefined)
      throw new WorkerBeeError(`Block ${headBlockNumber} is not available`);

    const transactions = block.transactions.map((tx, index) => ({
      id: block.transaction_ids[index],
      transaction: this.worker.chain!.createTransactionFromJson(tx).transaction
    }));

    return {
      BlockClassifier: {
        transactionsPerId: new Map<string, transaction>(block.transaction_ids.map((id, index) => [id, transactions[index].transaction])),
        transactions
      }
    } satisfies Partial<TAvailableClassifiers>;
  };
}
