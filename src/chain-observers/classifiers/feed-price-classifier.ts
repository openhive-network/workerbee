import { price } from "@hiveio/wax";
import { CollectorClassifierBase } from "./collector-classifier-base";

export interface IFeedPriceData {
  currentMedianHistory: price;
  marketMedianHistory: price;
  currentMinHistory: price;
  currentMaxHistory: price;
  /**
   * Note: This is a timestamp of the last feed price retrieval, not the actual feed price interval timestamp.
   */
  lastFeedPriceRetrievalTimestamp: Date;
  /**
   * Contains feed price history updated every hour from the latest to the oldest.
   */
  priceHistory: Iterable<price>;
}

export class FeedPriceClassifier extends CollectorClassifierBase<IFeedPriceData> {}
