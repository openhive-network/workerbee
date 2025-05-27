import { DynamicGlobalPropertiesClassifier, FeedPriceClassifier } from "../../classifiers";
import { TRegisterEvaluationContext } from "../../classifiers/collector-classifier-base";
import { IFeedPriceData } from "../../classifiers/feed-price-classifier";
import { DataEvaluationContext } from "../../factories/data-evaluation-context";
import { CollectorBase, TAvailableClassifiers } from "../collector-base";

const isDivisibleByInRange = (by: number, start: number, end: number) => {
  // Normalize start to the next multiple of *by*
  const firstMultiple = Math.ceil(start / by) * by;

  return firstMultiple <= end;
};

export class FeedPriceCollector extends CollectorBase<FeedPriceClassifier> {
  private cachedFeedHistoryData: IFeedPriceData | undefined;

  private previouslyCheckedBlockNumber = 0;

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [DynamicGlobalPropertiesClassifier];
  }

  public async get(data: DataEvaluationContext) {
    const { headBlockNumber } = await data.get(DynamicGlobalPropertiesClassifier);

    // Update feed price history every hour (HIVE_FEED_INTERVAL_BLOCKS) or when there is no cached data
    if ( this.cachedFeedHistoryData === undefined
      || isDivisibleByInRange(Number.parseInt(this.worker.chain!.config["HIVE_FEED_INTERVAL_BLOCKS"]), headBlockNumber, this.previouslyCheckedBlockNumber)
    ) {
      const startGetFeedHistory = Date.now();
      const feedHistoryData = await this.worker.chain!.api.database_api.get_feed_history({});
      data.addTiming("database_api.get_feed_history", Date.now() - startGetFeedHistory);

      this.cachedFeedHistoryData = {
        currentMedianHistory: feedHistoryData.current_median_history,
        marketMedianHistory: feedHistoryData.market_median_history,
        currentMinHistory: feedHistoryData.current_min_history,
        currentMaxHistory: feedHistoryData.current_max_history,
        priceHistory: feedHistoryData.price_history.reverse(),
        lastFeedPriceRetrievalTimestamp: new Date()
      };
    }

    this.previouslyCheckedBlockNumber = headBlockNumber;

    return {
      /*
       * Instruct TypeScript typings that FeedPriceClassifier.name is actualy a Classifier name we expect.
       * This is required for the bundlers to properly deduce the type of the classifier in data evaluation context.
       */
      [FeedPriceClassifier.name as "FeedPriceClassifier"]: this.cachedFeedHistoryData as TAvailableClassifiers["FeedPriceClassifier"]
    };
  };
}
