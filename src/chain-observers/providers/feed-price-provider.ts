import { price } from "@hiveio/wax";
import { WorkerBeeIterable } from "src/types/iterator";
import { FeedPriceClassifier } from "../classifiers";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { DataEvaluationContext } from "../factories/data-evaluation-context";
import { ProviderBase } from "./provider-base";

export interface IFeedPriceData {
  priceHistory: WorkerBeeIterable<price>;
  currentMinHistory: price;
  currentMaxHistory: price;
  currentMedianHistory: price;
}

export interface IFeedPriceProviderData {
  feedPrice: IFeedPriceData;
};

export class FeedPriceProvider extends ProviderBase {
  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      FeedPriceClassifier
    ]
  }

  public async provide(data: DataEvaluationContext): Promise<IFeedPriceProviderData> {
    const { currentMedianHistory, currentMinHistory, currentMaxHistory, priceHistory } = await data.get(FeedPriceClassifier);

    return {
      feedPrice: {
        currentMedianHistory,
        currentMinHistory,
        currentMaxHistory,
        priceHistory: new WorkerBeeIterable(priceHistory)
      }
    };
  }
}
