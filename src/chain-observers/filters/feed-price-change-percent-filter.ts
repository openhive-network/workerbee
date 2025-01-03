import { price } from "@hiveio/wax";
import type { WorkerBee } from "../../bot";
import { FeedPriceClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { DataEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class FeedPriceChangeFilter extends FilterBase {
  public constructor(
    worker: WorkerBee,
    private readonly feedPriceChangePercentMin: number
  ) {
    super(worker);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      FeedPriceClassifier
    ];
  }

  private previousUpdateTimestamp: Date | undefined;

  public async match(data: DataEvaluationContext): Promise<boolean> {
    const { priceHistory, lastFeedPriceRetrievalTimestamp } = await data.get(FeedPriceClassifier);

    if (this.previousUpdateTimestamp && this.previousUpdateTimestamp > lastFeedPriceRetrievalTimestamp)
      return false;

    const history: Array<Exclude<price, undefined>> = Array.from(priceHistory);
    if (history.length < 2)
      return false;

    const price1 = BigInt(history[0].base!.amount) / BigInt(history[0].quote!.amount);
    const price2 = BigInt(history[1].base!.amount) / BigInt(history[1].quote!.amount);

    let percentChange = (price1 - price2) * BigInt(100) / price2;

    if (percentChange < 0)
      percentChange = -percentChange;

    this.previousUpdateTimestamp = lastFeedPriceRetrievalTimestamp;

    return Number(percentChange.toString()) >= this.feedPriceChangePercentMin;
  }
}
