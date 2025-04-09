import { asset, EManabarType, TAccountName } from "@hiveio/wax";

import { WorkerBee } from "./bot";
import { AccountCreatedFilter } from "./chain-observers/filters/account-created-filter";
import { AccountFullManabarFilter } from "./chain-observers/filters/account-full-manabar-filter";
import { AccountMetadataChangeFilter } from "./chain-observers/filters/account-metadata-change-filter";
import { AlarmFilter } from "./chain-observers/filters/alarm-filter";
import { BalanceChangeFilter } from "./chain-observers/filters/balance-change-filter";
import { BlockNumberFilter } from "./chain-observers/filters/block-filter";
import { CommentFilter, ICommentData } from "./chain-observers/filters/comment-filter";
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
import { CustomOperationProvider } from "./chain-observers/providers/custom-operation-provider";
import { ExchangeTransferProvider } from "./chain-observers/providers/exchange-transfer-provider";
import { FeedPriceProvider } from "./chain-observers/providers/feed-price-provider";
import { FollowProvider } from "./chain-observers/providers/follow-provider";
import { ImpactedAccountProvider } from "./chain-observers/providers/impacted-account-provider";
import { InternalMarketProvider } from "./chain-observers/providers/internal-market-provider";
import { MentionedAccountProvider } from "./chain-observers/providers/mention-provider";
import { NewAccountProvider } from "./chain-observers/providers/new-account-provider";
import { PostProvider } from "./chain-observers/providers/post-provider";
import { ProviderBase } from "./chain-observers/providers/provider-base";
import { RcAccountProvider } from "./chain-observers/providers/rc-account-provider";
import { ReblogProvider } from "./chain-observers/providers/reblog-provider";
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
   * @example
   * ```ts
   * workerbee.observe.onTransactionId("555605d1e344cf3acb36c3e0631969b1b73f89b6").subscribe({
   *   next: (data) => {
   *     console.log('Got transaction:', data.transactions['555605d1e344cf3acb36c3e0631969b1b73f89b6']);
   *   }
   * });
   *
   * @param transactionId Transaction ID to subscribe to
   * @returns itself
   */
  public onTransactionId<
    TIdTx extends string
  >(transactionId: TIdTx): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<TransactionByIdProvider<[TIdTx]>["provide"]>>> {
    this.operands.push(new TransactionIdFilter(this.worker, transactionId));
    this.pushProvider(TransactionByIdProvider, { transactionIds: [transactionId] });

    return this;
  }

  /**
   * Notifies when the specified account has reached 98% of its mana/resource credits.
   *
   * @example
   * ```ts
   * workerbee.observe.onAccountFullManabar("username").subscribe({
   *   next: (data) => {
   *     console.log("Account manabar is now full");
   *   }
   * });
   * ```
   *
   * @param account The account name to monitor for full manabar
   * @param manabarType The type of manabar to monitor (default: {@link EManabarType.RC})
   * @param manabarLoadPercent The percentage of manabar load to trigger the notification
   *                           (default: `98`. Note: Setting it to 100 may not always work as expected due to inaccurate floating point math)
   * @returns itself
   */
  public onAccountFullManabar(
    account: TAccountName,
    manabarType: EManabarType = EManabarType.RC,
    manabarLoadPercent: number = 98
  ): QueenBee<TPreviousSubscriberData> {
    this.operands.push(new AccountFullManabarFilter(this.worker, account, manabarType, manabarLoadPercent));

    return this;
  }

  /**
   * Subscribes to changes in the balance of a specified account.
   * This method allows monitoring of balance changes for a given account, with an option to include or exclude internal transfers.
   *
   * @example
   * ```ts
   * workerbee.observe.onAccountBalanceChange("username", true).subscribe({
   *   next: () => {
   *     console.log("@username account balance changed");
   *   }
   * });
   * ```
   *
   * @param account The account name to monitor for balance changes.
   * @param includeInternalTransfers Whether to include internal transfers in the balance change monitoring (default: `false`).
   * @returns itself
   */
  public onAccountBalanceChange(account: TAccountName, includeInternalTransfers: boolean = false): QueenBee<TPreviousSubscriberData> {
    this.operands.push(new BalanceChangeFilter(this.worker, account, includeInternalTransfers));

    return this;
  }

  /**
   * Subscribes to changes in the metadata of a specified account.
   *
   * @example
   * ```ts
   * workerbee.observe.onAccountMetadataChange("username").subscribe({
   *   next: () => {
   *     console.log("Account @username metadata changed");
   *   }
   * });
   * ```
   *
   * @param account The account name to monitor for metadata changes.
   * @returns itself
   */
  public onAccountMetadataChange(account: TAccountName): QueenBee<TPreviousSubscriberData> {
    this.operands.push(new AccountMetadataChangeFilter(this.worker, account));

    return this;
  }

  /**
   * Subscribes to notifications when a vote is created by a specific account.
   *
   * Automatically provides the vote metadata in the `next` callback.
   *
   * @example
   * ```ts
   * workerbee.observe.onVoteCreated("username").subscribe({
   *   next: (data) => {
   *     for(const { operation } of data.votes["username"])
   *      console.log("Vote created:", operation);
   *   }
   * });
   * ```
   *
   * @param voter The account name of the voter to monitor for vote creation.
   * @returns itself
   */
  public onVoteCreated<
    TAccount extends TAccountName
  >(voter: TAccountName): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<VoteProvider<[TAccount]>["provide"]>>> {
    this.operands.push(new VoteFilter(this.worker, voter));
    this.pushProvider(VoteProvider, { voters: [voter] });

    return this;
  }

  /**
   * Subscribes to notifications when a post is created by a specific author.
   *
   * Automatically provides the post in the `next` callback.
   *
   * @example
   * ```ts
   * workerbee.observe.onPost("username").subscribe({
   *   next: (data) => {
   *     for(const { operation } of data.posts["username"])
   *      console.log("Post created:", operation);
   *   }
   * });
   * ```
   *
   * @param author The account name of the author to monitor for post creation.
   * @returns itself
   */
  public onPost<
    TAccount extends TAccountName
  >(author: TAccountName): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<PostProvider<[TAccount]>["provide"]>>> {
    this.operands.push(new PostFilter(this.worker, author));
    this.pushProvider(PostProvider, { authors: [author] });

    return this;
  }

  /**
   * Subscribes to notifications when a comment is created by a specific author.
   * You can optionally provide a filter for a specific permlink.
   *
   * Automatically provides the comment in the `next` callback.
   *
   * @example
   * ```ts
   * workerbee.observe.onComment("username", "specific-permlink").subscribe({
   *   next: (data) => {
   *     for(const { operation } of data.comments["username"])
   *      console.log("Comment created:", operation);
   *   }
   * });
   * ```
   *
   * @param author The account name of the author to monitor for comment creation.
   * @param parentPostOrComment (Optional) The specific data of the parent post/comment to monitor.
   * @returns itself
   */
  public onComment<
    TAccount extends TAccountName
  >(author: TAccount, parentPostOrComment?: ICommentData): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<CommentProvider<[TAccount]>["provide"]>>> {
    this.operands.push(new CommentFilter(this.worker, author));
    this.pushProvider(CommentProvider, { authors: [{ account: author, parentCommentFilter: parentPostOrComment }] });

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
   * @param id The ID of the custom operation to monitor.
   * @returns itself
   */
  public onCustomOperation<
    TOperationId extends string | number
  >(id: TOperationId): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<CustomOperationProvider<[TOperationId]>["provide"]>>> {
    this.operands.push(new CustomOperationFilter(this.worker, id));
    this.pushProvider(CustomOperationProvider, { ids: [id] });

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
   * @param reblogger The account name of the reblogger to monitor.
   * @returns itself
   */
  public onReblog<
    TReblog extends TAccountName
  >(reblogger: TReblog): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<MentionedAccountProvider<[TReblog]>["provide"]>>> {
    this.operands.push(new ReblogFilter(this.worker, reblogger));
    this.pushProvider(ReblogProvider, { accounts: [reblogger] });

    return this;
  }

  /**
   * Subscribes to notifications when a specific account performs follow operation, such as, e.g.: mute, follow blacklisted, blacklist, follow, unfollow.
   *
   * Automatically provides the follow operation metadata in the `next` callback.
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
   * @param follower The account name of the follower to monitor.
   * @returns itself
   */
  public onFollow<
    TFollow extends TAccountName
  >(follower: TFollow): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<FollowProvider<[TFollow]>["provide"]>>> {
    this.operands.push(new FollowFilter(this.worker, follower));
    this.pushProvider(FollowProvider, { accounts: [follower] });

    return this;
  }

  /**
   * Subscribes to notifications when a specific account is mentioned in a post.
   *
   * Automatically provides the comment operation metadata in the `next` callback.
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
   * @param mentionedAccount The account name to monitor for mentions.
   * @returns itself
   */
  public onMention<
    TMention extends TAccountName
  >(mentionedAccount: TMention): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<MentionedAccountProvider<[TMention]>["provide"]>>> {
    this.operands.push(new PostMentionFilter(this.worker, mentionedAccount));
    this.pushProvider(MentionedAccountProvider, { accounts: [mentionedAccount] });

    return this;
  }

  /**
   * Subscribes to notifications related to account alarms. This could include events like recovery account changes,
   * governance vote expirations, or declining voting rights.
   *
   * Automatically provides alarm-related data in the `next` callback.
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
   * @param watchAccount The account name to monitor for alarms.
   * @returns itself
   */
  public onAlarm<
    TAccount extends TAccountName
  >(watchAccount: TAccount): QueenBee<TPreviousSubscriberData & Awaited<ReturnType<AlarmProvider<[TAccount]>["provide"]>>> {
    this.operands.push(new AlarmFilter(this.worker, watchAccount));
    this.pushProvider(AlarmProvider, { accounts: [watchAccount] });

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
    for(let i = 0; i < accounts.length; ++i) {
      if (i > 0)
        this.applyOr(); // Add logical OR between each account filter to allow multiple accounts to be used in the same subscribe call

      this.operands.push(new ImpactedAccountFilter(this.worker, accounts[i]));
    }

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
   * @example
   * ```ts
   * workerbee.observe.onWitnessMissedBlocks("username", 5).subscribe({
   *   next: () => {
   *     console.log("Witness @username has missed 5 or more blocks!");
   *   }
   * });
   * ```
   *
   * @param witness The account name of the witness to monitor for missed blocks.
   * @param missedBlocksMinCount The minimum number of missed blocks that triggers the notification.
   * @returns itself
   */
  public onWitnessMissedBlocks(witness: TAccountName, missedBlocksMinCount: number): QueenBee<TPreviousSubscriberData> {
    this.operands.push(new WitnessMissedBlocksFilter(this.worker, witness, missedBlocksMinCount));

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
