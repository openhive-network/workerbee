import { ApiBlock, transaction } from "@hiveio/wax";
import { WorkerBee } from "../../../bot";
import { WorkerBeeError } from "../../../errors";
import { BlockClassifier, BlockHeaderClassifier } from "../../classifiers";
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

  public async fetchData(_: DataEvaluationContext) {
    if (this.toBlock !== undefined && this.currentBlockIndex > this.toBlock)
      throw new WorkerBeeError(`Block Buffer overflow in history data BlockCollector: ${this.currentBlockIndex} > ${this.toBlock}`);

    if (this.currentContainerIndex === -1 || this.currentContainerIndex >= this.cachedBlocksData.length) {
      this.currentContainerIndex = 0;
      ({ blocks: this.cachedBlocksData } = await this.worker.chain!.api.block_api.get_block_range({
        starting_block_num: this.currentBlockIndex,
        count: this.toBlock === undefined ? MAX_TAKE_BLOCKS : (
          this.currentBlockIndex + MAX_TAKE_BLOCKS > this.toBlock ? this.toBlock - this.currentBlockIndex + 1 : MAX_TAKE_BLOCKS
        )
      }));

      if (this.cachedBlocksData.length === 0)
        return {
          [BlockClassifier.name]: {
            transactionsPerId: new Map<string, transaction>(),
            transactions: []
          } as TAvailableClassifiers["BlockClassifier"],
          [BlockHeaderClassifier.name]: this.previousBlockHeaderData as TAvailableClassifiers["BlockHeaderClassifier"]
        } satisfies Partial<TAvailableClassifiers>;
    }

    const block = this.cachedBlocksData[this.currentContainerIndex];

    const transactions = block.transactions.map((tx, index) => ({
      id: block.transaction_ids[index],
      transaction: this.worker.chain!.createTransactionFromJson(tx).transaction
    }));

    ++this.currentContainerIndex;
    ++this.currentBlockIndex;

    return {
      [BlockClassifier.name]: {
        transactionsPerId: new Map<string, transaction>(block.transaction_ids.map((id, index) => [id, transactions[index].transaction])),
        transactions
      } as TAvailableClassifiers["BlockClassifier"],
      [BlockHeaderClassifier.name]: this.previousBlockHeaderData = {
        number: this.currentBlockIndex - 1,
        timestamp: new Date(`${block.timestamp}Z`),
        witness: block.witness,
        id: block.block_id
      } as TAvailableClassifiers["BlockHeaderClassifier"]
    } satisfies Partial<TAvailableClassifiers>;
  };
}
