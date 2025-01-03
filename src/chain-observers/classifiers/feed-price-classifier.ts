import { price } from "@hiveio/wax";
import { CollectorClassifierBase } from "./collector-classifier-base";

export interface IFeedPriceData {
  currentMedianHistory: price;
  marketMedianHistory: price;
  currentMinHistory: price;
  currentMaxHistory: price;
  priceHistory: Iterable<price>;
}

export class FeedPriceClassifier extends CollectorClassifierBase {
  public type!: IFeedPriceData;
}
