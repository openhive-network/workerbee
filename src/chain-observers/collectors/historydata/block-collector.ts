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
  private currentBlockIndex = -1;
  private currentContainerIndex = -1;
  private previousBlockHeaderData?: IBlockHeaderData;

  public constructor(
    protected readonly worker: WorkerBee,
    private readonly fromBlock: number,
    private readonly toBlock?: number
  ) {
    super(worker);

    this.currentBlockIndex = fromBlock;

    if (this.toBlock !== undefined && this.fromBlock > this.toBlock)
      throw new WorkerBeeError(`Invalid block range in history data BlockCollector: ${this.fromBlock} > ${this.toBlock}`);
  }

  private cachedBlocksData: ApiBlock[] = [];

  public async get(data: TCollectorEvaluationContext) {
    if (this.toBlock !== undefined && this.currentBlockIndex > this.toBlock)
      throw new WorkerBeeError(`Block Buffer overflow in history data BlockCollector: ${this.currentBlockIndex} > ${this.toBlock}`);

    if (this.currentContainerIndex === -1 || this.currentContainerIndex >= this.cachedBlocksData.length) {
      this.currentContainerIndex = 0;
      const startGetBlockRange = Date.now();
      ({ blocks: this.cachedBlocksData } = await this.worker.chain!.api.block_api.get_block_range({
        starting_block_num: this.currentBlockIndex,
        count: this.toBlock === undefined ? MAX_TAKE_BLOCKS : (
          this.currentBlockIndex + MAX_TAKE_BLOCKS > this.toBlock ? this.toBlock - this.currentBlockIndex + 1 : MAX_TAKE_BLOCKS
        )
      }));
      data.addTiming("block_api.get_block_range", Date.now() - startGetBlockRange);

      if (this.cachedBlocksData.length === 0)
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
            this.previousBlockHeaderData as TAvailableClassifiers["BlockHeaderClassifier"]
        };
    }

    const startBlockAnalysis = Date.now();

    const block = this.cachedBlocksData[this.currentContainerIndex];

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

    ++this.currentContainerIndex;
    ++this.currentBlockIndex;

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
      [BlockHeaderClassifier.name as "BlockHeaderClassifier"]: this.previousBlockHeaderData = {
        number: this.currentBlockIndex - 1,
        timestamp: new Date(`${block.timestamp}Z`),
        witness: block.witness,
        id: block.block_id
      } as TAvailableClassifiers["BlockHeaderClassifier"]
    };
  };
}
