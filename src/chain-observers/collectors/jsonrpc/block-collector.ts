import { ApiBlock, transaction } from "@hiveio/wax";
import { BlockNotAvailableError, WorkerBeeError } from "../../../errors";
import { DynamicGlobalPropertiesClassifier, BlockClassifier } from "../../classifiers";
import { ITransactionData } from "../../classifiers/block-classifier";
import { TRegisterEvaluationContext } from "../../classifiers/collector-classifier-base";
import { TCollectorEvaluationContext } from "../../factories/data-evaluation-context";
import { CollectorBase, TAvailableClassifiers } from "../collector-base";

const MAX_BLOCK_RANGE_FETCH = 1_000;

export class BlockCollector extends CollectorBase<BlockClassifier> {
  private currentHeadBlock = -1;

  private cachedBlockData!: BlockClassifier["getType"];

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [DynamicGlobalPropertiesClassifier];
  }

  public async get(data: TCollectorEvaluationContext) {
    const { headBlockNumber } = await data.get(DynamicGlobalPropertiesClassifier);

    if(this.currentHeadBlock === headBlockNumber)
      return {
        /*
         * Instruct TypeScript typings that BlockClassifier.name is actualy a Classifier name we expect.
         * This is required for the bundlers to properly deduce the type of the classifier in data evaluation context.
         */
        [BlockClassifier.name as "BlockClassifier"]: this.cachedBlockData as TAvailableClassifiers["BlockClassifier"]
      };

    const blocks: Array<ApiBlock> = [];

    if (this.currentHeadBlock !== -1 && headBlockNumber !== this.currentHeadBlock + 1) {
      if (headBlockNumber - this.currentHeadBlock - 1 > MAX_BLOCK_RANGE_FETCH)
        throw new WorkerBeeError(`Something went terribly wrong. Cannot catch up block range larger than ${
          MAX_BLOCK_RANGE_FETCH} blocks. Current head: ${this.currentHeadBlock}, requested head: ${headBlockNumber}`);


      // Fetch missing blocks
      const startMultiBlock = Date.now();
      const { blocks } = await this.worker.chain.api.block_api.get_block_range({
        starting_block_num: this.currentHeadBlock + 1,
        count: headBlockNumber - this.currentHeadBlock - 1
      });
      data.addTiming("block_api.get_block_range", Date.now() - startMultiBlock);

      if (blocks.length === 0)
        throw new WorkerBeeError(`Could not fetch missing blocks from ${this.currentHeadBlock + 1} to ${headBlockNumber}`);


      blocks.push(...blocks);
    } else {
      const startBlock = Date.now();
      const { block } = await this.worker.chain!.api.block_api.get_block({ block_num: headBlockNumber });
      data.addTiming("block_api.get_block", Date.now() - startBlock);

      if (block === undefined)
        throw new BlockNotAvailableError(headBlockNumber);

      blocks.push(block);
    }

    this.currentHeadBlock = this.currentHeadBlock === -1 ? headBlockNumber : this.currentHeadBlock + blocks.length;

    const startBlockAnalysis = Date.now();
    const transactions: ITransactionData[] = [];
    const transactionsPerId = new Map<string, transaction>();
    for(const block of blocks)
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
