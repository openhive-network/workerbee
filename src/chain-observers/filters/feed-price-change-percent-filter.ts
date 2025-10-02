import { price } from "@hiveio/wax";
import { FeedPriceClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { TFilterEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class FeedPriceChangeFilter extends FilterBase {
  public constructor(
    private readonly feedPriceChangePercentMin: number
  ) {
    super();
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      FeedPriceClassifier
    ];
  }

  private previousUpdateTimestamp: Date | undefined;

  public async match(data: TFilterEvaluationContext): Promise<boolean> {
    const { priceHistory, lastFeedPriceRetrievalTimestamp } = await data.get(FeedPriceClassifier);

    if (this.previousUpdateTimestamp && this.previousUpdateTimestamp > lastFeedPriceRetrievalTimestamp)
      return false;

    const history: Array<Exclude<price, undefined>> = Array.from(priceHistory);
    if (history.length < 2)
      return false;

    const price1 = Number.parseInt(history[0].base!.amount) / Number.parseInt(history[0].quote!.amount);
    const price2 = Number.parseInt(history[1].base!.amount) / Number.parseInt(history[1].quote!.amount);

    // Avoid division by zero
    if (price2 === 0)
      return false;

    const percentChange = Math.abs(price1 - price2) / price2 * 100;

    this.previousUpdateTimestamp = lastFeedPriceRetrievalTimestamp;

    return percentChange >= this.feedPriceChangePercentMin;
  }
}
