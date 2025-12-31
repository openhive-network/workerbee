import { ApiBlock, transaction } from "@hiveio/wax";
import { WorkerBee } from "../../../bot";
import { WorkerBeeError } from "../../../errors";
import { BlockClassifier, BlockHeaderClassifier } from "../../classifiers";
import { ITransactionData } from "../../classifiers/block-classifier";
import { IBlockHeaderData } from "../../classifiers/block-header-classifier";
import { TCollectorEvaluationContext } from "../../factories/data-evaluation-context";
import { CollectorBase, TAvailableClassifiers } from "../collector-base";

const MAX_TAKE_BLOCKS = 1000;


export class BlockCollector extends CollectorBase<BlockClassifier> {
  #currentBlockIndex = -1;
  #currentContainerIndex = -1;
  #previousBlockHeaderData?: IBlockHeaderData;
  readonly #fromBlock: number;
  readonly #toBlock?: number;

  public constructor(
    worker: WorkerBee,
    fromBlock: number,
    toBlock?: number
  ) {
    super(worker);
    this.#fromBlock = fromBlock;
    this.#toBlock = toBlock;

    this.#currentBlockIndex = fromBlock;

    if (this.#toBlock !== undefined && this.#fromBlock > this.#toBlock)
      throw new WorkerBeeError(`Invalid block range in history data BlockCollector: ${this.#fromBlock} > ${this.#toBlock}`);
  }

  #cachedBlocksData: ApiBlock[] = [];

  public async get(data: TCollectorEvaluationContext) {
    if (this.#toBlock !== undefined && this.#currentBlockIndex > this.#toBlock)
      throw new WorkerBeeError(`Block Buffer overflow in history data BlockCollector: ${this.#currentBlockIndex} > ${this.#toBlock}`);

    if (this.#currentContainerIndex === -1 || this.#currentContainerIndex >= this.#cachedBlocksData.length) {
      this.#currentContainerIndex = 0;
      const startGetBlockRange = Date.now();
      const blockRangeResponse = await this.worker.chain!.api.block_api.get_block_range({
        starting_block_num: this.#currentBlockIndex,
        count: this.#toBlock === undefined ? MAX_TAKE_BLOCKS : (
          this.#currentBlockIndex + MAX_TAKE_BLOCKS > this.#toBlock ? this.#toBlock - this.#currentBlockIndex + 1 : MAX_TAKE_BLOCKS
        )
      });
      data.addTiming("block_api.get_block_range", Date.now() - startGetBlockRange);

      if (blockRangeResponse === null || blockRangeResponse.blocks === undefined)
        throw new WorkerBeeError(`BlockCollector: Invalid block range response starting from block #${this.#currentBlockIndex}`);

      ({ blocks: this.#cachedBlocksData } = blockRangeResponse);

      if (this.#cachedBlocksData.length === 0) {
        /*
         * Handle the case when this is the first call and we get no blocks back
         * This can be caused by invalid fromBlock provided or no blocks produced yet
         */
        if (this.#currentBlockIndex === this.#fromBlock)
          throw new WorkerBeeError(`BlockCollector: No blocks returned from get_block_range starting from block #${this.#fromBlock}`);

        return {
          /*
           * Instruct TypeScript typings that BlockClassifier.name is actualy a Classifier name we expect.
           * This is required for the bundlers to properly deduce the type of the classifier in data evaluation context.
           */
          [BlockClassifier.name as "BlockClassifier"]: {
            transactionsPerId: new Map<string, transaction>(),
            transactions: []
          } as TAvailableClassifiers["BlockClassifier"],
          [BlockHeaderClassifier.name as "BlockHeaderClassifier"]:
            this.#previousBlockHeaderData as TAvailableClassifiers["BlockHeaderClassifier"]
        };
      }
    }

    const startBlockAnalysis = Date.now();

    const block = this.#cachedBlocksData[this.#currentContainerIndex];

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

    ++this.#currentContainerIndex;
    ++this.#currentBlockIndex;

    data.addTiming("blockAnalysis", Date.now() - startBlockAnalysis);

    return {
      /*
       * Instruct TypeScript typings that BlockClassifier.name is actualy a Classifier name we expect.
       * This is required for the bundlers to properly deduce the type of the classifier in data evaluation context.
       */
      [BlockClassifier.name as "BlockClassifier"]: {
        transactionsPerId,
        transactions
      } as TAvailableClassifiers["BlockClassifier"],
      [BlockHeaderClassifier.name as "BlockHeaderClassifier"]: this.#previousBlockHeaderData = {
        number: this.#currentBlockIndex - 1,
        timestamp: new Date(`${block.timestamp}Z`),
        witness: block.witness,
        id: block.block_id
      } as TAvailableClassifiers["BlockHeaderClassifier"]
    };
  };
}
