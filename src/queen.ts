import { asset, EManabarType, TAccountName } from "@hiveio/wax";

import { WorkerBee } from "./bot";
import { AccountCreatedFilter } from "./chain-observers/filters/account-created-filter";
import { AccountFullManabarFilter } from "./chain-observers/filters/account-full-manabar-filter";
import { AccountMetadataChangeFilter } from "./chain-observers/filters/account-metadata-change-filter";
import { AlarmFilter } from "./chain-observers/filters/alarm-filter";
import { BalanceChangeFilter } from "./chain-observers/filters/balance-change-filter";
import { BlockNumberFilter } from "./chain-observers/filters/block-filter";
import { CommentFilter } from "./chain-observers/filters/comment-filter";
import { LogicalAndFilter, LogicalOrFilter } from "./chain-observers/filters/composite-filter";
import { CustomOperationFilter } from "./chain-observers/filters/custom-operation-filter";
import { ExchangeTransferFilter } from "./chain-observers/filters/exchange-transfer-filter";
import { FeedPriceChangeFilter } from "./chain-observers/filters/feed-price-change-percent-filter";
import { FeedPriceNoChangeFilter } from "./chain-observers/filters/feed-price-no-change-filter";
import type { FilterBase } from "./chain-observers/filters/filter-base";
import { FollowFilter } from "./chain-observers/filters/follow-filter";
import { ImpactedAccountFilter } from "./chain-observers/filters/impacted-account-filter";
import { InternalMarketFilter } from "./chain-observers/filters/internal-market-filter";
import { BlockChangedFilter } from "./chain-observers/filters/new-block-filter";
import { PostFilter } from "./chain-observers/filters/post-filter";
import { PostMentionFilter } from "./chain-observers/filters/post-mention";
import { ReblogFilter } from "./chain-observers/filters/reblog-filter";
import { TransactionIdFilter } from "./chain-observers/filters/transaction-id-filter";
import { VoteFilter } from "./chain-observers/filters/vote-filter";
import { WhaleAlertFilter } from "./chain-observers/filters/whale-alert-filter";
import { WitnessMissedBlocksFilter } from "./chain-observers/filters/witness-miss-block-filter";
import { ObserverMediator } from "./chain-observers/observer-mediator";
import { AccountProvider } from "./chain-observers/providers/account-provider";
import { AlarmProvider } from "./chain-observers/providers/alarm-provider";
import { BlockHeaderProvider } from "./chain-observers/providers/block-header-provider";
import { BlockProvider } from "./chain-observers/providers/block-provider";
import { CommentProvider } from "./chain-observers/providers/comment-provider";
import { ExchangeTransferProvider } from "./chain-observers/providers/exchange-transfer-provider";
import { FeedPriceProvider } from "./chain-observers/providers/feed-price-provider";
import { ImpactedAccountProvider } from "./chain-observers/providers/impacted-account-provider";
import { InternalMarketProvider } from "./chain-observers/providers/internal-market-provider";
import { MentionedAccountProvider } from "./chain-observers/providers/mention-provider";
import { PostProvider } from "./chain-observers/providers/post-provider";
import { ProviderBase } from "./chain-observers/providers/provider-base";
import { RcAccountProvider } from "./chain-observers/providers/rc-account-provider";
import { TransactionByIdProvider } from "./chain-observers/providers/transaction-provider";
import { VoteProvider } from "./chain-observers/providers/vote-provider";
import { WhaleAlertProvider } from "./chain-observers/providers/whale-alert-provider";
import { WitnessProvider } from "./chain-observers/providers/witness-provider";
import type { Observer, Unsubscribable } from "./types/subscribable";

export class QueenBee<TPreviousSubscriberData extends object = {}> {
  public constructor(
    protected readonly worker: WorkerBee,
    protected readonly mediator: ObserverMediator = worker.mediator
  ) {}

  protected providers = new Map<new () => ProviderBase, ProviderBase>();
  protected operands: FilterBase[] = [];
  protected filterContainers: FilterBase[] = [];

  /**
   * Internal function to be called when the subscription is created.
   */
  protected onSubscribe(): void {}

  public subscribe(observer: Partial<Observer<TPreviousSubscriberData>>): Unsubscribable {
    if (this.operands.length > 0) {
      if (this.operands.length === 1) // Optimize by not creating a logical AND filter for only one filter
        this.filterContainers.push(this.operands[0]);
      else
        this.filterContainers.push(new LogicalAndFilter(this.worker, this.operands));
      this.operands = [];
    }

    const committedFilters = this.filterContainers;
    // Optimize by not creating a logical OR filter for only one filter
    const orFilter: FilterBase = committedFilters.length === 1 ? committedFilters[0] : new LogicalOrFilter(this.worker, committedFilters);

    this.mediator.registerListener(observer, orFilter, Array.from(this.providers.values()));

    this.onSubscribe();

    this.filterContainers = [];
    this.providers = new Map();

    return {
      unsubscribe: () => {
        this.mediator.unregisterListener(observer);
        // XXX: Maybe force cancel here
      }
    };
  }

  private applyOr(): void {
    if (this.operands.length > 0) {
      if (this.operands.length === 1) // Optimize by not creating a logical AND filter for only one filter
        this.filterContainers.push(this.operands[0]);
      else
        this.filterContainers.push(new LogicalAndFilter(this.worker, this.operands));
      this.operands = [];
    }
  }

  public get or(): QueenBee<TPreviousSubscriberData> {
    this.applyOr();

    return this as unknown as QueenBee<TPreviousSubscriberData>;
  }

  private pushProvider<T extends new () => ProviderBase>(
    provider: T,
    options: InstanceType<T>["pushOptions"] extends undefined ? {} : Parameters<Exclude<InstanceType<T>["pushOptions"], undefined>>[0] = {}
  ) {
    let instance = this.providers.get(provider);

    if (!instance)
      this.providers.set(provider, instance = new provider());

    instance.pushOptions?.(options);
  }

  public onBlockNumber(number: number): QueenBee<TPreviousSubscriberData> {
    this.operands.push(new BlockNumberFilter(this.worker, number));

    return this;
  }

  public onTransactionId<
    TIdTx extends string
  >(transactionId: TIdTx): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<TransactionByIdProvider<[TIdTx]>["provide"]>>> {
    this.operands.push(new TransactionIdFilter(this.worker, transactionId));
    this.pushProvider(TransactionByIdProvider, { transactionIds: [transactionId] });

    return this;
  }

  public onAccountFullManabar(account: TAccountName, manabarType: EManabarType = EManabarType.RC): QueenBee<TPreviousSubscriberData> {
    this.operands.push(new AccountFullManabarFilter(this.worker, account, manabarType));

    return this;
  }

  public onAccountBalanceChange(account: TAccountName, includeInternalTransfers: boolean = false): QueenBee<TPreviousSubscriberData> {
    this.operands.push(new BalanceChangeFilter(this.worker, account, includeInternalTransfers));

    return this;
  }

  public onAccountMetadataChange(account: TAccountName): QueenBee<TPreviousSubscriberData> {
    this.operands.push(new AccountMetadataChangeFilter(this.worker, account));

    return this;
  }

  public onVoteCreated<
    TAccount extends TAccountName
  >(voter: TAccountName): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<VoteProvider<[TAccount]>["provide"]>>> {
    this.operands.push(new VoteFilter(this.worker, voter));
    this.pushProvider(VoteProvider, { voters: [voter] });

    return this;
  }

  public onPostCreated<
    TAccount extends TAccountName
  >(author: TAccountName): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<PostProvider<[TAccount]>["provide"]>>> {
    this.operands.push(new PostFilter(this.worker, author));
    this.pushProvider(PostProvider, { authors: [author] });

    return this;
  }

  public onCommentCreated<
    TAccount extends TAccountName
  >(author: TAccount, permlink?: string): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<CommentProvider<[TAccount]>["provide"]>>> {
    this.operands.push(new CommentFilter(this.worker, author));
    this.pushProvider(CommentProvider, { authors: [{ account: author, permlink }] });

    return this;
  }

  public onNewAccount(): QueenBee<TPreviousSubscriberData> {
    this.operands.push(new AccountCreatedFilter(this.worker));

    return this;
  }

  public onCustomOperation(id: string | number): QueenBee<TPreviousSubscriberData> {
    this.operands.push(new CustomOperationFilter(this.worker, id));

    return this;
  }

  public onFeedPriceChange(percent: number): QueenBee<TPreviousSubscriberData> {
    this.operands.push(new FeedPriceChangeFilter(this.worker, percent));

    return this;
  }

  public onFeedPriceNoChange(lastHoursCount: number = 24): QueenBee<TPreviousSubscriberData> {
    this.operands.push(new FeedPriceNoChangeFilter(this.worker, lastHoursCount));

    return this;
  }

  public provideFeedPriceData(): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<FeedPriceProvider["provide"]>>> {
    this.pushProvider(FeedPriceProvider);

    return this;
  }

  public onReblog(reblogger: TAccountName): QueenBee<TPreviousSubscriberData> {
    this.operands.push(new ReblogFilter(this.worker, reblogger));

    return this;
  }

  public onFollow(follower: TAccountName): QueenBee<TPreviousSubscriberData> {
    this.operands.push(new FollowFilter(this.worker, follower));

    return this;
  }

  public onMention<
    TMention extends TAccountName
  >(mentionedAccount: TMention): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<MentionedAccountProvider<[TMention]>["provide"]>>> {
    this.operands.push(new PostMentionFilter(this.worker, mentionedAccount));
    this.pushProvider(MentionedAccountProvider, { accounts: [mentionedAccount] });

    return this;
  }

  public onAlarm<
    TAccount extends TAccountName
  >(watchAccount: TAccount): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<AlarmProvider<[TAccount]>["provide"]>>> {
    this.operands.push(new AlarmFilter(this.worker, watchAccount));
    this.pushProvider(AlarmProvider, { accounts: [watchAccount] });

    return this;
  }

  public onImpactedAccounts<
    TAccounts extends TAccountName[]
  >(...accounts: TAccounts): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<ImpactedAccountProvider<TAccounts>["provide"]>>> {
    for(let i = 0; i < accounts.length; ++i) {
      if (i > 0)
        this.applyOr(); // Add logical OR between each account filter to allow multiple accounts to be used in the same subscribe call

      this.operands.push(new ImpactedAccountFilter(this.worker, accounts[i]));
    }

    this.pushProvider(ImpactedAccountProvider, { accounts });

    return this;
  }

  public onWitnessMissedBlocks(witness: TAccountName, missedBlocksMinCount: number): QueenBee<TPreviousSubscriberData> {
    this.operands.push(new WitnessMissedBlocksFilter(this.worker, witness, missedBlocksMinCount));

    return this;
  }

  public onInternalMarketOperation(): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<InternalMarketProvider["provide"]>>> {
    this.operands.push(new InternalMarketFilter(this.worker));
    this.pushProvider(InternalMarketProvider);

    return this;
  }

  public onBlock(): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<BlockHeaderProvider["provide"]>>> {
    this.operands.push(new BlockChangedFilter(this.worker));
    this.pushProvider(BlockHeaderProvider);

    return this;
  }

  public provideAccounts<
    TAccounts extends Array<TAccountName>
  >(...accounts: TAccounts): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<AccountProvider<TAccounts>["provide"]>>> {
    this.pushProvider(AccountProvider, { accounts });

    return this;
  }

  public provideWitnesses<
    TAccounts extends Array<TAccountName>
  >(...witnesses: TAccounts): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<WitnessProvider<TAccounts>["provide"]>>> {
    this.pushProvider(WitnessProvider, { accounts: witnesses });

    return this;
  }

  public provideRcAccounts<
    TAccounts extends Array<TAccountName>
  >(...accounts: TAccounts): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<RcAccountProvider<TAccounts>["provide"]>>> {
    this.pushProvider(RcAccountProvider, { accounts });

    return this;
  }

  public onWhaleAlert(asset: asset): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<WhaleAlertProvider["provide"]>>> {
    this.operands.push(new WhaleAlertFilter(this.worker, asset));
    this.pushProvider(WhaleAlertProvider, { assets: [asset] });

    return this;
  }

  public onExchangeTransfer(): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<ExchangeTransferProvider["provide"]>>> {
    this.operands.push(new ExchangeTransferFilter(this.worker));
    this.pushProvider(ExchangeTransferProvider);

    return this;
  }

  public provideBlockHeaderData(): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<BlockHeaderProvider["provide"]>>> {
    this.pushProvider(BlockHeaderProvider);

    return this;
  }

  public provideBlockData(): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<BlockProvider["provide"]>>> {
    this.pushProvider(BlockProvider);

    return this;
  }
}
