import { WorkerBee } from "./bot";
import { HistoryDataFactory } from "./chain-observers/factories/historydata/factory";
import { ObserverMediator } from "./chain-observers/observer-mediator";
import { QueenBee } from "./queen";

export type TPastQueen<TPreviousSubscriberData extends object = {}> = Omit<
  PastQueen<TPreviousSubscriberData>,
  "onAccountsFullManabar" | "onAccountsBalanceChange" | "onAccountsMetadataChange" |
  "onFeedPriceChange"     | "onFeedPriceNoChange"     | "provideFeedPriceData"     |
  "onAlarm"               | "onWitnessesMissedBlocks" | "provideAccounts"          |
  "provideWitnesses"      | "provideRcAccounts"
>;

export class PastQueen<TPreviousSubscriberData extends object = {}> extends QueenBee<TPreviousSubscriberData> {
  public constructor(
    worker: WorkerBee,
    fromBlock: number,
    toBlock?: number
  ) {
    super(worker, new ObserverMediator(new HistoryDataFactory(worker, fromBlock, toBlock)));
  }

  protected onUnsubscribe(): void {
    // Pass all the data retrieved by the past queen to the top-level mediator
    this.worker.mediator.extend(this.mediator);
  }

  protected onSubscribe(): void {
    this.mediator.notify();
  }
}
