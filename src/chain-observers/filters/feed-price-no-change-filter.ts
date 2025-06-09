import type { WorkerBee } from "../../bot";
import { FeedPriceClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { TFilterEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class FeedPriceNoChangeFilter extends FilterBase {
  /**
   * @param worker @internal
   * @param feedPriceNoChangeIntervals In standard configuration - one interval is one hour, so the default 24 intervals is one day.
   */
  public constructor(
    worker: WorkerBee,
    private readonly feedPriceNoChangeIntervals: number = 24
  ) {
    super(worker);
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

    let previousPrice: bigint | undefined;
    let index = 0;
    let priceChanged = false;

    for(const entry of priceHistory) {
      const price = BigInt(entry.base!.amount) / BigInt(entry.quote!.amount);

      if (previousPrice === undefined) {
        previousPrice = price;
        continue;
      }

      if (previousPrice !== price) {
        priceChanged = true;
        break;
      }

      ++index;
      if (index >= this.feedPriceNoChangeIntervals)
        break;
    }

    return priceChanged;
  }
}
