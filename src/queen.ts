import { asset, EManabarType, TAccountName } from "@hiveio/wax";

import { WorkerBee } from "./bot";
import { AccountCreatedFilter } from "./chain-observers/filters/account-created-filter";
import { AccountFullManabarFilter } from "./chain-observers/filters/account-full-manabar-filter";
import { AccountMetadataChangeFilter } from "./chain-observers/filters/account-metadata-change-filter";
import { AlarmFilter } from "./chain-observers/filters/alarm-filter";
import { BalanceChangeFilter } from "./chain-observers/filters/balance-change-filter";
import { BlockNumberFilter } from "./chain-observers/filters/block-filter";
import { CommentFilter, PostFilter } from "./chain-observers/filters/blog-content-filter";
import { LogicalAndFilter, LogicalOrFilter } from "./chain-observers/filters/composite-filter";
import { CommentMetadataFilter, PostMetadataFilter } from "./chain-observers/filters/content-metadata-filter";
import { CustomOperationFilter } from "./chain-observers/filters/custom-operation-filter";
import { ExchangeTransferFilter } from "./chain-observers/filters/exchange-transfer-filter";
import { FeedPriceChangeFilter } from "./chain-observers/filters/feed-price-change-percent-filter";
import { FeedPriceNoChangeFilter } from "./chain-observers/filters/feed-price-no-change-filter";
import type { FilterBase } from "./chain-observers/filters/filter-base";
import { FollowFilter } from "./chain-observers/filters/follow-filter";
import { ImpactedAccountFilter } from "./chain-observers/filters/impacted-account-filter";
import { InternalMarketFilter } from "./chain-observers/filters/internal-market-filter";
import { BlockChangedFilter } from "./chain-observers/filters/new-block-filter";
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
import { CommentProvider, PostProvider } from "./chain-observers/providers/blog-content-provider";
import { CommentMetadataProvider, PostMetadataProvider } from "./chain-observers/providers/content-metadata-provider";
import { CustomOperationProvider } from "./chain-observers/providers/custom-operation-provider";
import { ExchangeTransferProvider } from "./chain-observers/providers/exchange-transfer-provider";
import { FeedPriceProvider } from "./chain-observers/providers/feed-price-provider";
import { FollowProvider } from "./chain-observers/providers/follow-provider";
import { ImpactedAccountProvider } from "./chain-observers/providers/impacted-account-provider";
import { InternalMarketProvider } from "./chain-observers/providers/internal-market-provider";
import { ManabarProvider } from "./chain-observers/providers/manabar-provider";
import { MentionedAccountProvider } from "./chain-observers/providers/mention-provider";
import { NewAccountProvider } from "./chain-observers/providers/new-account-provider";
import { ProviderBase } from "./chain-observers/providers/provider-base";
import { RcAccountProvider } from "./chain-observers/providers/rc-account-provider";
import { ReblogProvider } from "./chain-observers/providers/reblog-provider";
import { TransactionByIdProvider } from "./chain-observers/providers/transaction-provider";
import { VoteProvider } from "./chain-observers/providers/vote-provider";
import { WhaleAlertProvider } from "./chain-observers/providers/whale-alert-provider";
import { WitnessProvider } from "./chain-observers/providers/witness-provider";
import type { Observer, Unsubscribable } from "./types/subscribable";
import { calculateRelativeTime } from "./utils/time";

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
  /**
   * Internal function to be called when the subscription is unsubscribed.
   */
  protected onUnsubscribe(): void {}

  /**
   * Subscribe to the requested filters and providers.
   * The filters are combined using logical AND/OR operators.
   * Providers are always called upon first filter match.
   *
   * Note: Some providers may only produce data for effective events/accounts.
   * It means that you can get keys in provided data associated only to some accounts
   * (those which performed operations)
   *
   * @example
   * ```ts
   * workerbee.observe.onPost("test").subscribe({
   *   next: (data) => {
   *     console.log(data);
   *   }
   * });
   * ```
   *
   * @param observer observer to be notified when the filters are triggered.
   *
   * @returns Unsubscribable object that can be used to unsubscribe from the filters
   */
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

    const usedMediator = this.mediator;

    return {
      get timings() {
        return usedMediator.timings;
      },
      unsubscribe: () => {
        this.mediator.unregisterListener(observer);
        this.onUnsubscribe();
      }
    } as Unsubscribable & { timings: Readonly<Record<string, number>> };
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

  /**
   * Apply logical OR between the filters.
   * This is used to combine multiple filters into a single filter.
   *
   * @example
   * ```ts
   * workerbee.observe.onPost("test").or.onComment("test").subscribe({
   *   next: (data) => {
   *     console.log(data);
   *   }
   * });
   * ```
   */
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

  /**
   * Subscribe to the specific block number.
   * This is useful for testing purposes or when you want to get data from a specific block in the future.
   *
   * @example
   * ```ts
   * workerbee.observe.onBlockNumber(12_345_678).subscribe({
   *   next: () => {
   *     console.log('Block 12_345_678 detected');
   *   }
   * });
   *
   * @param number Block number to subscribe to
   * @returns itself
   */
  public onBlockNumber(number: number): QueenBee<TPreviousSubscriberData> {
    this.operands.push(new BlockNumberFilter(this.worker, number));

    return this;
  }

  /**
   * Subscribe to the specific transaction ID.
   * This is useful for transactions that are not yet confirmed or when you want to get data from a specific transaction in the future.
   *
   * Automatically provides the transaction in the `next` callback.
   *
   * Note: This method implicitly applies the OR operator between the specified transaction IDs.
   *
   * @example
   * ```ts
   * workerbee.observe.onTransactionIds("555605d1e344cf3acb36c3e0631969b1b73f89b6").subscribe({
   *   next: (data) => {
   *     console.log('Got transaction:', data.transactions['555605d1e344cf3acb36c3e0631969b1b73f89b6']);
   *   }
   * });
   *
   * @param transactionId Transaction ID to subscribe to
   * @returns itself
   */
  public onTransactionIds<
    TIdTxs extends Array<string>
  >(...transactionIds: TIdTxs): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<TransactionByIdProvider<TIdTxs>["provide"]>>> {
    this.operands.push(new TransactionIdFilter(this.worker, transactionIds));
    this.pushProvider(TransactionByIdProvider, { transactionIds });

    return this;
  }

  /**
   * Notifies when the specified account(s) has reached 98% of its mana/resource credits.
   *
   * Automatically provides the manabar data in the `next` callback.
   *
   * Note: This method implicitly applies the OR operator between the specified accounts.
   *
   * @example
   * ```ts
   * workerbee.observe.onAccountsFullManabar(EManabarType.RC, "username", "username2").subscribe({
   *   next: (data) => {
   *     // Note: When providing multiple accounts with implicit OR, you should check for the actual mana load in the `next` callback
   *     for(const account in data.manabarData)
   *       if(data.manabarData[account]?.[EManabarType.RC] && data.manabarData[account].[EManabarType.RC].percent >= 98)
   *         console.log("Account manabar is now loaded %:", data.manabarData[account][EManabarType.RC].percent);
   *   }
   * });
   * ```
   *
   * @param manabarType The type of manabar to monitor (default: {@link EManabarType.RC})
   * @param accounts account names to monitor for full manabar
   * @returns itself
   */
  public onAccountsFullManabar<
    TAccounts extends TAccountName[]
  >(
    manabarType: EManabarType,
    ...accounts: TAccounts
  ): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<ManabarProvider<TAccounts>["provide"]>>> {
    return this.onAccountsManabarPercent<TAccounts>(manabarType, 98, ...accounts);
  }

  /**
   * Notifies when the specified account(s) has reached request percentage of its mana/resource credits.
   *
   * Automatically provides the manabar data in the `next` callback.
   *
   * Note: This method implicitly applies the OR operator between the specified accounts.
   *
   * @example
   * ```ts
   * workerbee.observe.onAccountsManabarPercent(EManabarType.RC, 50, "username", "username2").subscribe({
   *   next: (data) => {
   *     // Note: When providing multiple accounts with implicit OR, you should check for the actual mana load in the `next` callback
   *     for(const account in data.manabarData)
   *       if(data.manabarData[account]?.[EManabarType.RC] && data.manabarData[account][EManabarType.RC].percent >= 50)
   *         console.log("Account manabar is now loaded %:", data.manabarData[account][EManabarType.RC].percent);
   *   }
   * });
   * ```
   *
   * @param manabarType The type of manabar to monitor (default: {@link EManabarType.RC})
   * @param manabarLoadPercent The percentage of manabar load to trigger the notification
   * @param accounts account names to monitor for full manabar
   * @returns itself
   */
  public onAccountsManabarPercent<
    TAccounts extends TAccountName[]
  >(
    manabarType: EManabarType,
    percent: number,
    ...accounts: TAccounts
  ): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<ManabarProvider<TAccounts>["provide"]>>> {
    this.operands.push(new AccountFullManabarFilter(this.worker, accounts, manabarType, percent));

    this.pushProvider(ManabarProvider, { manabarData: accounts.map(account => ({ account, manabarType })) });

    return this;
  }

  /**
   * Subscribes to changes in the balance of a specified account.
   * This method allows monitoring of balance changes for a given account, with an option to include or exclude internal transfers.
   *
   * @example
   * ```ts
   * workerbee.observe.onAccountsBalanceChange(false, "username").subscribe({
   *   next: () => {
   *     console.log("@username account balance changed");
   *   }
   * });
   * ```
   *
   * @param includeInternalTransfers Whether to include internal transfers in the balance change monitoring.
   * @param accounts The account name to monitor for balance changes.
   * @returns itself
   */
  public onAccountsBalanceChange(includeInternalTransfers: boolean, ...accounts: TAccountName[]): QueenBee<TPreviousSubscriberData> {
    this.operands.push(new BalanceChangeFilter(this.worker, accounts, includeInternalTransfers));

    return this;
  }

  /**
   * Subscribes to changes in the metadata of a specified account.
   *
   * @example
   * ```ts
   * workerbee.observe.onAccountsMetadataChange("username").subscribe({
   *   next: () => {
   *     console.log("Account @username metadata changed");
   *   }
   * });
   * ```
   *
   * @param accounts The account name to monitor for metadata changes.
   * @returns itself
   */
  public onAccountsMetadataChange(...accounts: TAccountName[]): QueenBee<TPreviousSubscriberData> {
    this.operands.push(new AccountMetadataChangeFilter(this.worker, accounts));

    return this;
  }

  /**
   * Subscribes to notifications when a vote is created by a specific account(s).
   *
   * Automatically provides the vote metadata in the `next` callback.
   *
   * Note: This method implicitly applies the OR operator between the specified accounts.
   *
   * @example
   * ```ts
   * workerbee.observe.onVotes("username", "username2").subscribe({
   *   next: (data) => {
   *     for(const account in data.votes)
   *       if(data.votes[account] !== undefined)
   *         for(const { operation } of data.votes[account])
   *           console.log("Vote created:", operation);
   *   }
   * });
   * ```
   *
   * @param voters The account name of the voter to monitor for vote creation.
   * @returns itself
   */
  public onVotes<
    TAccounts extends TAccountName[]
  >(...voters: TAccounts): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<VoteProvider<TAccounts>["provide"]>>> {
    this.operands.push(new VoteFilter(this.worker, voters));

    this.pushProvider(VoteProvider, { voters });

    return this;
  }

  /**
   * Subscribes to notifications when a post is created by a specific author(s).
   *
   * Automatically provides the post in the `next` callback.
   *
   * Note: This method implicitly applies the OR operator between the specified accounts.
   *
   * @example
   * ```ts
   * workerbee.observe.onPosts("username", "username2").subscribe({
   *   next: (data) => {
   *     for(const account in data.posts)
   *       if(data.posts[account] !== undefined)
   *         for(const { operation } of data.posts[account])
   *           console.log("Post created:", operation);
   *   }
   * });
   * ```
   *
   * @param authors account names of the authors to monitor for post creation.
   * @returns itself
   */
  public onPosts<
    TAccounts extends TAccountName[]
  >(...authors: TAccounts): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<PostProvider<TAccounts>["provide"]>>> {
    this.operands.push(new PostFilter(this.worker, authors));

    this.pushProvider(PostProvider, { authors });

    return this;
  }

  /**
   * Subscribes to notifications when a comment is created by a specific author(s).
   *
   * Automatically provides the comment in the `next` callback.
   *
   * Note: This method implicitly applies the OR operator between the specified accounts.
   *
   * @example
   * ```ts
   * workerbee.observe.onComments("username", "username2").subscribe({
   *   next: (data) => {
   *     for(const account in data.comments)
   *       if(data.comments[account] !== undefined)
   *         for(const { operation } of data.comments[account])
   *           console.log("Comment created:", operation);
   *   }
   * });
   * ```
   *
   * @param authors account names of the authors to monitor for comment creation.
   * @returns itself
   */
  public onComments<
    TAccounts extends TAccountName[]
  >(...authors: TAccounts): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<CommentProvider<TAccounts>["provide"]>>> {
    // TODO: Handle parentPostOrComment?: ICommentData

    this.operands.push(new CommentFilter(this.worker, authors));

    this.pushProvider(CommentProvider, { authors: authors.map(account => ({ account })) });

    return this;
  }

  /**
   * Subscribes to notifications when a comment is near its payout time by a specific author(s).
   *
   * Automatically provides the comment in the `next` callback.
   *
   * Note: This method implicitly applies the OR operator between the specified accounts.
   *
   * @example
   * ```ts
   * workerbee.observe.onCommentsIncomingPayout("username", "username2").subscribe({
   *   next: (data) => {
   *     for(const account in data.commentsMetadata)
   *       if(data.commentsMetadata[account] !== undefined)
   *         for(const permlink of data.commentsMetadata[account])
   *           console.log("Comment about to payout:", data.commentsMetadata[account][permlink]);
   *   }
   * });
   * ```
   *
   * @param relativeTimeMs The relative time in milliseconds or a string representing the time duration (e.g., "-1h", "-30m") to monitor for comment payouts.
   * @param authors account names of the authors to monitor for comment payout.
   * @returns itself
   */
  public onCommentsIncomingPayout<
    TAccounts extends TAccountName[]
  >(
    relativeTimeMs: number | string, ...authors: TAccounts
  ): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<CommentMetadataProvider<TAccounts>["provide"]>>> {
    const time = typeof relativeTimeMs === "number" ? relativeTimeMs : (Date.now() - calculateRelativeTime(relativeTimeMs).getTime());

    this.operands.push(new CommentMetadataFilter(this.worker, time, authors));

    this.pushProvider(CommentMetadataProvider, { authors });

    return this;
  }

  /**
   * Subscribes to notifications when a post is near its payout time by a specific author(s).
   *
   * Automatically provides the post in the `next` callback.
   *
   * Note: This method implicitly applies the OR operator between the specified accounts.
   *
   * @example
   * ```ts
   * workerbee.observe.onPostsIncomingPayout("username", "username2").subscribe({
   *   next: (data) => {
   *     for(const account in data.postsMetadata)
   *       if(data.postsMetad
   *const time = typeof relativeTimeMs === "number" ? relativeTimeMs : (Date.now() - calculateRelativeTime(relativeTimeMs).getTime());
   * @param relativeTimeMs The relative time in milliseconds or a string representing the time duration (e.g., "-1h", "-30m") to monitor for post payouts.
   * @param authors account names of the authors to monitor for post payout.
   * @returns itself
   */
  public onPostsIncomingPayout<
    TAccounts extends TAccountName[]
  >(relativeTimeMs: number | string, ...authors: TAccounts):
    QueenBee<TPreviousSubscriberData & Awaited<ReturnType<PostMetadataProvider<TAccounts>["provide"]>>> {
    const time = typeof relativeTimeMs === "number" ? relativeTimeMs : (Date.now() - calculateRelativeTime(relativeTimeMs).getTime());

    this.operands.push(new PostMetadataFilter(this.worker, time, authors));

    this.pushProvider(PostMetadataProvider, { authors });

    return this;
  }

  /**
   * Subscribes to notifications when a new account is created.
   *
   * Automatically provides the new account metadata in the `next` callback.
   *
   * @example
   * ```ts
   * workerbee.observe.onNewAccount().subscribe({
   *   next: (data) => {
   *     for(const { accountName } of data.newAccounts)
   *      console.log("New account created:", accountName);
   *   }
   * });
   * ```
   *
   * @returns itself
   */
  public onNewAccount(): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<NewAccountProvider["provide"]>>> {
    this.operands.push(new AccountCreatedFilter(this.worker));
    this.pushProvider(NewAccountProvider);

    return this;
  }

  /**
   * Subscribes to notifications when a custom operation with a specific ID is processed.
   *
   * Automatically provides the custom JSON operation in the `next` callback.
   *
   * Note: This method implicitly applies the OR operator between the specified ids.
   *
   * @example
   * ```ts
   * workerbee.observe.onCustomOperation("sm_claim_reward").subscribe({
   *   next: (data) => {
   *     for(const { operation } of data.customOperations["sm_claim_reward"])
   *      console.log("Splinterlands reward claimed:", operation);
   *   }
   * });
   * ```
   *
   * @param ids The ID of the custom operation to monitor.
   * @returns itself
   */
  public onCustomOperation<
    TOperationId extends Array<string | number>
  >(...ids: TOperationId): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<CustomOperationProvider<TOperationId>["provide"]>>> {
    this.operands.push(new CustomOperationFilter(this.worker, ids));
    this.pushProvider(CustomOperationProvider, { ids });

    return this;
  }

  /**
   * Subscribes to notifications when the feed price changes by a specified percentage.
   *
   * @example
   * ```ts
   * workerbee.observe.onFeedPriceChange(5).subscribe({
   *   next: () => {
   *     console.log("Feed price changed by 5%");
   *   }
   * });
   * ```
   *
   * @param percent The percentage by which the feed price must change to trigger the notification.
   * @returns itself
   */
  public onFeedPriceChange(percent: number): QueenBee<TPreviousSubscriberData> {
    this.operands.push(new FeedPriceChangeFilter(this.worker, percent));

    return this;
  }

  /**
   * Subscribes to notifications when the feed price remains unchanged for a specified duration (in hours).
   *
   * @example
   * ```ts
   * workerbee.observe.onFeedPriceNoChange(48).subscribe({
   *   next: () => {
   *     console.log("Feed price has not changed for 48 hours!");
   *   }
   * });
   * ```
   *
   * @param lastHoursCount The number of hours to monitor for feed price stability (default: `24` hours).
   * @returns itself
   */
  public onFeedPriceNoChange(lastHoursCount: number = 24): QueenBee<TPreviousSubscriberData> {
    this.operands.push(new FeedPriceNoChangeFilter(this.worker, lastHoursCount));

    return this;
  }

  /**
   * Provides the feed price data in the `next` callback.
   *
   * @example
   * ```ts
   * workerbee.observe.onBlock().provideFeedPriceData().subscribe({
   *   next: (data) => {
   *     console.log("Feed price data:", data.feedPrice);
   *   }
   * });
   * ```
   *
   * @returns itself
   */
  public provideFeedPriceData(): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<FeedPriceProvider["provide"]>>> {
    this.pushProvider(FeedPriceProvider);

    return this;
  }

  /**
   * Subscribes to notifications when a post is reblogged by a specific account.
   *
   * Automatically provides the reblog operation metadata in the `next` callback.
   *
   * Note: This method implicitly applies the OR operator between the specified accounts.
   *
   * @example
   * ```ts
   * workerbee.observe.onReblog("username").subscribe({
   *   next: (data) => {
   *     for(const { operation } of data.reblogs["username"])
   *      console.log("Post reblogged:", operation);
   *   }
   * });
   * ```
   *
   * @param rebloggers The account names of the rebloggers to monitor.
   * @returns itself
   */
  public onReblog<
    TReblogs extends TAccountName[]
  >(...rebloggers: TReblogs): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<MentionedAccountProvider<TReblogs>["provide"]>>> {
    this.operands.push(new ReblogFilter(this.worker, rebloggers));
    this.pushProvider(ReblogProvider, { accounts: rebloggers });

    return this;
  }

  /**
   * Subscribes to notifications when a specific account performs follow operation, such as, e.g.: mute, follow blacklisted, blacklist, follow, unfollow.
   *
   * Automatically provides the follow operation metadata in the `next` callback.
   *
   * Note: This method implicitly applies the OR operator between the specified accounts.
   *
   * @example
   * ```ts
   * workerbee.observe.onFollow("trustworthy.account").subscribe({
   *   next: (data) => {
   *     for(const { operation } of data.reblogs["trustworthy.account"])
   *      console.log("@trustworthy.account followed:", operation);
   *   }
   * });
   * ```
   *
   * @param followers The account names of the followers to monitor.
   * @returns itself
   */
  public onFollow<
    TFollows extends TAccountName[]
  >(...followers: TFollows): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<FollowProvider<TFollows>["provide"]>>> {
    this.operands.push(new FollowFilter(this.worker, followers));
    this.pushProvider(FollowProvider, { accounts: followers });

    return this;
  }

  /**
   * Subscribes to notifications when a specific account is mentioned in a post.
   *
   * Automatically provides the comment operation metadata in the `next` callback.
   *
   * Note: This method implicitly applies the OR operator between the specified accounts.
   *
   * @example
   * ```ts
   * workerbee.observe.onMention("username").subscribe({
   *   next: (data) => {
   *     for(const { operation } of data.mentioned["username"])
   *      console.log("@username mentioned in post:", operation);
   *   }
   * });
   * ```
   *
   * @param mentionedAccounts The account names to monitor for mentions.
   * @returns itself
   */
  public onMention<
    TMentions extends TAccountName[]
  >(...mentionedAccounts: TMentions): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<MentionedAccountProvider<TMentions>["provide"]>>> {
    this.operands.push(new PostMentionFilter(this.worker, mentionedAccounts));
    this.pushProvider(MentionedAccountProvider, { accounts: mentionedAccounts });

    return this;
  }

  /**
   * Subscribes to notifications related to account alarms. This could include events like recovery account changes,
   * governance vote expirations, or declining voting rights.
   *
   * Automatically provides alarm-related data in the `next` callback.
   *
   * Note: This method implicitly applies the OR operator between the specified accounts.
   *
   * @example
   * ```ts
   * workerbee.observe.onAlarm("username").subscribe({
   *   next: (data) => {
   *     for(const alarmType of data.alarmsPerAccount["username"])
   *      console.log("@username account alarm!:", alarmType);
   *   }
   * });
   * ```
   *
   * @param watchAccounts The account names to monitor for alarms.
   * @returns itself
   */
  public onAlarm<
    TAccounts extends TAccountName[]
  >(...watchAccounts: TAccounts): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<AlarmProvider<TAccounts>["provide"]>>> {
    this.operands.push(new AlarmFilter(this.worker, watchAccounts));
    this.pushProvider(AlarmProvider, { accounts: watchAccounts });

    return this;
  }

  /**
   * Subscribes to notifications when operations impact specific accounts. This allows monitoring of various actions
   * that affect the specified accounts, such as transfers, votes, post creations etc.
   *
   * Automatically provides the impacted account operation metadata in the `next` callback. The data includes
   * a list of operations and transactions that involve the specified accounts.
   *
   * Note: This method implicitly applies the OR operator between the specified accounts.
   *
   * @example
   * ```ts
   * workerbee.observe.onImpactedAccounts("account1", "account2").subscribe({
   *   next: (data) => {
   *     for (const account in data.impactedAccounts)
   *       for(const { transaction } of data.impactedAccounts[account])
   *         console.log(`Transaction #${transaction.id} impacted ${account}`);
   *   }
   * });
   * ```
   *
   * @param accounts The account names to monitor for impacted operations.
   * @returns itself
   */
  public onImpactedAccounts<
    TAccounts extends TAccountName[]
  >(...accounts: TAccounts): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<ImpactedAccountProvider<TAccounts>["provide"]>>> {
    this.operands.push(new ImpactedAccountFilter(this.worker, accounts));

    this.pushProvider(ImpactedAccountProvider, { accounts });

    return this;
  }

  /**
   * Subscribes to notifications when a witness misses a specified minimum number of blocks.
   *
   * Note: This filter will trigger only once per missed block count.
   * If witness catches up with no miessed blocks, it will be automatically re-enabled and will trigger
   * when the witness misses the specified number of blocks again.
   *
   * Note: This method implicitly applies the OR operator between the specified accounts.
   *
   * @example
   * ```ts
   * workerbee.observe.onWitnessesMissedBlocks(5, "username").subscribe({
   *   next: () => {
   *     console.log("Witness @username has missed 5 or more blocks!");
   *   }
   * });
   * ```
   *
   * @param missedBlocksMinCount The minimum number of missed blocks that triggers the notification.
   * @param witnesses The account names of the witnesses to monitor for missed blocks.
   * @returns itself
   */
  public onWitnessesMissedBlocks(missedBlocksMinCount: number, ...witnesses: TAccountName[]): QueenBee<TPreviousSubscriberData> {
    this.operands.push(new WitnessMissedBlocksFilter(this.worker, witnesses, missedBlocksMinCount));

    return this;
  }

  /**
   * Subscribes to notifications related to internal market operations, such as limit order creation and cancellation.
   *
   * Automatically provides the internal market operation metadata in the `next` callback.
   * The data includes details about the order, such as the owner, order ID, amounts, and exchange rates.
   *
   * @example
   * ```ts
   * workerbee.observe.onInternalMarketOperation().subscribe({
   *   next: (data) => {
   *     for (const { operation } of data.internalMarketOperations) {
   *       if (operation.cancel) {
   *         console.log(`Order ${operation.orderId} cancelled by ${operation.owner}`);
   *       } else {
   *         console.log(`Order ${operation.orderId} created by ${operation.owner}`);
   *       }
   *     }
   *   }
   * });
   * ```
   * @returns itself
   */
  public onInternalMarketOperation(): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<InternalMarketProvider["provide"]>>> {
    this.operands.push(new InternalMarketFilter(this.worker));
    this.pushProvider(InternalMarketProvider);

    return this;
  }

  /**
   * Subscribes to notifications when a new block is produced.
   *
   * Automatically provides the block header data in the `next` callback.
   *
   * @example
   * ```ts
   * workerbee.observe.onBlock().subscribe({
   *   next: (data) => {
   *     console.log("New block detected:", data.block.number);
   *   }
   * });
   * ```
   * @returns itself
   */
  public onBlock(): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<BlockHeaderProvider["provide"]>>> {
    this.operands.push(new BlockChangedFilter(this.worker));
    this.pushProvider(BlockHeaderProvider);

    return this;
  }

  /**
   * Provides data for the specified accounts in the `next` callback.
   *
   * @example
   * ```ts
   * workerbee.observe.onBlock().provideAccounts("account1", "account2").subscribe({
   *   next: (data) => {
   *     console.log("Account 1 data:", data.accounts["account1"]);
   *     console.log("Account 2 data:", data.accounts["account2"]);
   *   }
   * });
   * ```
   *
   * @param accounts The account names to provide data for.
   * @returns itself
   */
  public provideAccounts<
    TAccounts extends Array<TAccountName>
  >(...accounts: TAccounts): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<AccountProvider<TAccounts>["provide"]>>> {
    this.pushProvider(AccountProvider, { accounts });

    return this;
  }

  /**
   * Provides data for the specified witnesses in the `next` callback.
   *
   * @example
   * ```ts
   * workerbee.observe.onBlock().provideWitnesses("witness1", "witness2").subscribe({
   *   next: (data) => {
   *     console.log("Witness 1 data:", data.witnesses["witness1"]);
   *     console.log("Witness 2 data:", data.witnesses["witness2"]);
   *   }
   * });
   * ```
   *
   * @param witnesses The witness names to provide data for.
   * @returns itself
   */
  public provideWitnesses<
    TAccounts extends Array<TAccountName>
  >(...witnesses: TAccounts): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<WitnessProvider<TAccounts>["provide"]>>> {
    this.pushProvider(WitnessProvider, { accounts: witnesses });

    return this;
  }

  /**
   * Provides data for the specified accounts' RC in the `next` callback.
   *
   * @example
   * ```ts
   * workerbee.observe.onBlock().provideRcAccounts("account1", "account2").subscribe({
   *   next: (data) => {
   *     console.log("Account 1 RC:", data.rcAccounts["account1"]);
   *     console.log("Account 2 RC:", data.rcAccounts["account2"]);
   *   }
   * });
   * ```
   *
   * @param accounts The account names to provide data for.
   * @returns itself
   */
  public provideRcAccounts<
    TAccounts extends Array<TAccountName>
  >(...accounts: TAccounts): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<RcAccountProvider<TAccounts>["provide"]>>> {
    this.pushProvider(RcAccountProvider, { accounts });

    return this;
  }

  /**
   * Subscribes to notifications when a large transfer (whale alert) occurs for a specific asset.
   *
   * Automatically provides whale alert data in the `next` callback.
   *
   * @example
   * ```ts
   * workerbee.observe.onWhaleAlert(wax.hiveCoins(1_000)).subscribe({
   *   next: (data) => {
   *     for(const { operation } of data.whaleOperations)
   *      console.log("Whale alert! Transfer of >= 1_000 HIVE detected:", operation);
   *   }
   * });
   * ```
   *
   * @param asset The asset to monitor for whale alerts.
   * @returns itself
   */
  public onWhaleAlert(asset: asset): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<WhaleAlertProvider["provide"]>>> {
    this.operands.push(new WhaleAlertFilter(this.worker, asset));
    this.pushProvider(WhaleAlertProvider, { assets: [asset] });

    return this;
  }

  /**
   * Subscribes to notifications when a transfer to or from a known exchange occurs.
   *
   * Automatically provides exchange transfer data in the `next` callback.
   * The data includes details about the transfer, such as the from account, to account, amount, and the exchange involved.
   *
   * Note: On escrow_transfer operation, hbd_amount is used as the general-purpose amount field.
   * This is because the escrow_transfer operation is used for both HIVE and HBD transfers.
   * If you want to extract the HIVE amount, you should extract it directly from the provided operations within transaction.
   *
   * @example
   * ```ts
   * workerbee.observe.onExchangeTransfer().subscribe({
   *   next: (data) => {
   *     for (const { operation } of data.exchangeTransferOperations) {
   *       console.log(`Transfer from exchange ${operation.exchange} (${operation.from}) -> ${operation.to} with amount ${operation.amount.amount}`);
   *     }
   *   }
   * });
   * ```
   *
   * @returns itself
   */
  public onExchangeTransfer(): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<ExchangeTransferProvider["provide"]>>> {
    this.operands.push(new ExchangeTransferFilter(this.worker));
    this.pushProvider(ExchangeTransferProvider);

    return this;
  }

  /**
   * Provides block header data in the `next` callback.
   *
   * @example
   * ```ts
   * workerbee.observe.onBlock().provideBlockHeaderData().subscribe({
   *   next: (data) => {
   *     console.log("New block detected:", data.block.number);
   *   }
   * });
   * ```
   *
   * @returns itself
   */
  public provideBlockHeaderData(): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<BlockHeaderProvider["provide"]>>> {
    this.pushProvider(BlockHeaderProvider);

    return this;
  }

  /**
   * Provides the manabar data in the `next` callback.
   *
   * @example
   * ```ts
   * workerbee.observe.onBlock().provideManabarData(EManabarType.RC, "username1", "username2").subscribe({
   *   next: (data) => {
   *     console.log("Account manabar is now loaded %:", data.manabarData["username1"][EManabarType.RC].percent);
   *   }
   * });
   * ```
   *
   * @param manabarType The type of manabar to monitor
   * @param accounts The account names to monitor for full manabar
   * @returns itself
   */
  public provideManabarData<
    TAccounts extends Array<TAccountName>
  >(
    manabarType: EManabarType,
    ...accounts: TAccounts
  ): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<ManabarProvider<TAccounts>["provide"]>>> {
    this.pushProvider(ManabarProvider, { manabarData: accounts.map(account => ({ account, manabarType })) });

    return this;
  }

  /**
   * Provides block data in the `next` callback.
   *
   * Automatically provides both block header and block data.
   *
   * @example
   * ```ts
   * workerbee.observe.onBlock().provideBlockData().subscribe({
   *   next: (data) => {
   *     console.log("New block detected:", data.block.number);
   *     console.log("Block transactions:", data.block.transactions);
   *   }
   * });
   * ```
   *
   * @returns itself
   */
  public provideBlockData(): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<BlockProvider["provide"]>>> {
    this.pushProvider(BlockProvider);

    return this;
  }
}
