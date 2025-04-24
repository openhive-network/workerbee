import { ApiBlock, transaction } from "@hiveio/wax";
import { WorkerBee } from "../../../bot";
import { WorkerBeeError } from "../../../errors";
import { ITransactionData } from "../../classifiers/block-classifier";
import { IBlockHeaderData } from "../../classifiers/block-header-classifier";
import { DataEvaluationContext } from "../../factories/data-evaluation-context";
import { CollectorBase, TAvailableClassifiers } from "../collector-base";

const MAX_TAKE_BLOCKS = 1000;


export class BlockCollector extends CollectorBase {
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

  public async fetchData(data: DataEvaluationContext) {
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
          BlockClassifier: {
            transactionsPerId: new Map<string, transaction>(),
            transactions: []
          },
          BlockHeaderClassifier: this.previousBlockHeaderData
        } satisfies Partial<TAvailableClassifiers>;
    }

    const startBlockAnalysis = Date.now();

    const block = this.cachedBlocksData[this.currentContainerIndex];

    const transactions: ITransactionData[] = [];
    const transactionsPerId = new Map<string, transaction>();
    for(const tx of block.transactions) {
      const transaction = this.worker.chain!.createTransactionFromJson(tx);
      transactions.push({
        transaction: transaction.transaction,
        id: transaction.id,
      });
      transactionsPerId.set(transaction.id, transaction.transaction);
    }

    ++this.currentContainerIndex;
    ++this.currentBlockIndex;

    data.addTiming("blockAnalysis", Date.now() - startBlockAnalysis);

    return {
      BlockClassifier: {
        transactionsPerId,
        transactions
      },
      BlockHeaderClassifier: this.previousBlockHeaderData = {
        number: this.currentBlockIndex - 1,
        timestamp: new Date(`${block.timestamp}Z`),
        witness: block.witness,
        id: block.block_id
      }
    } satisfies Partial<TAvailableClassifiers>;
  };
}
