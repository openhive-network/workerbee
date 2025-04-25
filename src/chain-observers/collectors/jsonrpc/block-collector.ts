import { transaction } from "@hiveio/wax";
import { ITransactionData } from "src/chain-observers/classifiers/block-classifier";
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

    const startBlock = Date.now();
    const { block } = await this.worker.chain!.api.block_api.get_block({ block_num: headBlockNumber });
    data.addTiming("block_api.get_block", Date.now() - startBlock);

    if (block === undefined)
      throw new WorkerBeeError(`Block ${headBlockNumber} is not available`);

    const startBlockAnalysis = Date.now();
    const transactions: ITransactionData[] = [];
    const transactionsPerId = new Map<string, transaction>();
    for(let i = 0; i < block.transactions.length; ++i) {
      const transaction = this.worker.chain!.createTransactionFromJson(block.transactions[i]);
      transactions.push({
        transaction: transaction.transaction,
        id: block.transaction_ids[i]
      });
      transactionsPerId.set(block.transaction_ids[i], transaction.transaction);
    }

    data.addTiming("blockAnalysis", Date.now() - startBlockAnalysis);

    return {
      BlockClassifier: (this.cachedBlockData = {
        transactionsPerId,
        transactions
      })
    } satisfies Partial<TAvailableClassifiers>;
  };
}
