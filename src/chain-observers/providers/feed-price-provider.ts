import { price } from "@hiveio/wax";
import { WorkerBeeIterable } from "../../types/iterator";
import { FeedPriceClassifier } from "../classifiers";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { TProviderEvaluationContext } from "../factories/data-evaluation-context";
import { ProviderBase } from "./provider-base";

export interface IFeedPriceData {
  priceHistory: WorkerBeeIterable<price>;
  currentMinHistory: price;
  currentMaxHistory: price;
  currentMedianHistory: price;
}

export interface IFeedPriceProviderData {
  feedPrice?: IFeedPriceData;
};

export class FeedPriceProvider extends ProviderBase<{}, IFeedPriceProviderData> {
  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      FeedPriceClassifier
    ]
  }

  public get baseStructure(): IFeedPriceProviderData {
    return {};
  }

  public async provide(data: TProviderEvaluationContext): Promise<IFeedPriceProviderData> {
    const result = this.baseStructure;

    const { currentMedianHistory, currentMinHistory, currentMaxHistory, priceHistory } = await data.get(FeedPriceClassifier);

    result.feedPrice = {
      currentMedianHistory,
      currentMinHistory,
      currentMaxHistory,
      priceHistory: new WorkerBeeIterable(priceHistory)
    };

    return result;
  }
}
