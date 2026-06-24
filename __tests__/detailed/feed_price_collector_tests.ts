import { expect } from "@playwright/test";

import { DynamicGlobalPropertiesClassifier, FeedPriceClassifier } from "../../src/chain-observers/classifiers";
import { FeedPriceCollector } from "../../src/chain-observers/collectors/jsonrpc/feed-price-collector";
import type { TCollectorEvaluationContext } from "../../src/chain-observers/factories/data-evaluation-context";
import { test } from "../assets/jest-helper";

class RecordingDatabaseApi {
  public callCount = 0;

  public get_feed_history(): Promise<Record<string, object>> {
    ++this.callCount;

    return Promise.resolve({
      current_median_history: { base: "0.300 HBD", quote: "1.000 HIVE" },
      market_median_history: { base: "0.305 HBD", quote: "1.000 HIVE" },
      current_min_history: { base: "0.290 HBD", quote: "1.000 HIVE" },
      current_max_history: { base: "0.310 HBD", quote: "1.000 HIVE" },
      price_history: [ { base: "0.300 HBD", quote: "1.000 HIVE" } ]
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
    throw new Error("FeedPriceCollector.get must not call query");
  }

  public addTiming(): void {}
}

test.describe("WorkerBee feed price collector verification", () => {
  test("uses chain HIVE_FEED_INTERVAL_BLOCKS for refresh cadence", async() => {
    const databaseApi = new RecordingDatabaseApi();
    const worker = {
      chain: {
        config: {
          HIVE_FEED_INTERVAL_BLOCKS: "20"
        },
        api: {
          database_api: databaseApi
        }
      }
    };
    const collector = new FeedPriceCollector(worker as any);
    const context = new HeadContext([ 10, 19, 20 ]) as TCollectorEvaluationContext;

    await collector.get(context);
    await collector.get(context);
    expect(databaseApi.callCount).toBe(1);

    const result = await collector.get(context);
    expect(databaseApi.callCount).toBe(2);
    expect(result[FeedPriceClassifier.name as "FeedPriceClassifier"].priceHistory).toEqual([
      { base: "0.300 HBD", quote: "1.000 HIVE" }
    ]);
  });
});
