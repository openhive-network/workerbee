import { expect } from "@playwright/test";

import { BlockClassifier, DynamicGlobalPropertiesClassifier } from "../../src/chain-observers/classifiers";
import { BlockCollector } from "../../src/chain-observers/collectors/jsonrpc/block-collector";
import type { TCollectorEvaluationContext } from "../../src/chain-observers/factories/data-evaluation-context";
import { test } from "../assets/jest-helper";

type TBlockTransaction = { height: number };
type TTestBlock = {
  transactions: TBlockTransaction[];
  transaction_ids: string[];
};

const makeBlock = (height: number): TTestBlock => ({
  transactions: [ { height } ],
  transaction_ids: [ `tx-${height}` ]
});

class RecordingBlockApi {
  public blockCalls: number[] = [];
  public rangeCalls: Array<{ startingBlockNum: number; count: number }> = [];

  public get_block({ block_num }: { block_num: number }): Promise<{ block: TTestBlock }> {
    this.blockCalls.push(block_num);

    return Promise.resolve({ block: makeBlock(block_num) });
  }

  public get_block_range({ starting_block_num, count }: { starting_block_num: number; count: number }): Promise<{ blocks: TTestBlock[] }> {
    this.rangeCalls.push({ startingBlockNum: starting_block_num, count });

    return Promise.resolve({
      blocks: Array.from({ length: count }, (_, offset) => makeBlock(starting_block_num + offset))
    });
  }
}

class HeadContext {
  private readonly heads: number[];

  public constructor(heads: number[]) {
    this.heads = [ ...heads ];
  }

  public get(classifier: typeof DynamicGlobalPropertiesClassifier): Promise<{ headBlockNumber: number }> {
    expect(classifier).toBe(DynamicGlobalPropertiesClassifier);

    return Promise.resolve({ headBlockNumber: this.heads.shift()! });
  }

  public query(): Promise<never> {
    throw new Error("BlockCollector.get must not call query");
  }

  public addTiming(): void {}
}

test.describe("WorkerBee JSON-RPC block collector verification", () => {
  test("catch-up fetches through the advertised head", async() => {
    const blockApi = new RecordingBlockApi();
    const worker = {
      chain: {
        api: {
          block_api: blockApi
        },
        createTransactionFromJson(transaction: TBlockTransaction) {
          return { transaction };
        }
      }
    };
    const collector = new BlockCollector(worker as any);
    const context = new HeadContext([ 10, 12 ]) as TCollectorEvaluationContext;

    const first = await collector.get(context);
    const second = await collector.get(context);

    expect(first[BlockClassifier.name as "BlockClassifier"].transactions.map(({ id }) => id)).toEqual([ "tx-10" ]);
    expect(blockApi.blockCalls).toEqual([ 10 ]);
    expect(blockApi.rangeCalls).toEqual([ { startingBlockNum: 11, count: 2 } ]);

    const blockData = second[BlockClassifier.name as "BlockClassifier"];
    expect(blockData.transactions.map(({ id }) => id)).toEqual([ "tx-11", "tx-12" ]);
    expect(Array.from(blockData.transactionsPerId.entries())).toEqual([
      [ "tx-11", { height: 11 } ],
      [ "tx-12", { height: 12 } ]
    ]);
  });
});
