import { transaction } from "@hiveio/wax";
import { ITransactionData } from "src/chain-observers/classifiers/block-classifier";
import { WorkerBeeError } from "../../../errors";
import { DynamicGlobalPropertiesClassifier, BlockClassifier } from "../../classifiers";
import { TRegisterEvaluationContext } from "../../classifiers/collector-classifier-base";
import { DataEvaluationContext } from "../../factories/data-evaluation-context";
import { CollectorBase, TAvailableClassifiers } from "../collector-base";

export class BlockCollector extends CollectorBase<BlockClassifier> {
  private currentHeadBlock = -1;

  private cachedBlockData!: BlockClassifier["getType"];

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [DynamicGlobalPropertiesClassifier];
  }

  public async get(data: DataEvaluationContext) {
    const { headBlockNumber } = await data.get(DynamicGlobalPropertiesClassifier);

    if(this.currentHeadBlock === headBlockNumber)
      return {
        /*
         * Instruct TypeScript typings that BlockClassifier.name is actualy a Classifier name we expect.
         * This is required for the bundlers to properly deduce the type of the classifier in data evaluation context.
         */
        [BlockClassifier.name as "BlockClassifier"]: this.cachedBlockData as TAvailableClassifiers["BlockClassifier"]
      };

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
      /*
       * Instruct TypeScript typings that BlockClassifier.name is actualy a Classifier name we expect.
       * This is required for the bundlers to properly deduce the type of the classifier in data evaluation context.
       */
      [BlockClassifier.name as "BlockClassifier"]: (this.cachedBlockData = {
        transactionsPerId,
        transactions
      }) as TAvailableClassifiers["BlockClassifier"]
    };
  };
}
