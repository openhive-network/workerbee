# WorkerBee Filter Categories Tree

```text
QueenBee 🐝
├── 👤 Account Management
│   ├── AccountCreatedFilter (onNewAccount)
│   ├── AccountMetadataChangeFilter (onAccountsMetadataChange)
│   ├── AccountFullManabarFilter (onAccountsFullManabar, onAccountsManabarPercent)
│   └── ImpactedAccountFilter (onImpactedAccounts)
│
├── 👥 Social & Content
│   ├── PostFilter (onPosts)
│   ├── CommentFilter (onComments)
│   ├── PostMetadataFilter (onPostsIncomingPayout)
│   ├── CommentMetadataFilter (onCommentsIncomingPayout)
│   ├── VoteFilter (onVotes)
│   ├── ReblogFilter (onReblog)
│   ├── FollowFilter (onFollow)
│   ├── PostMentionFilter (onMention)
│   └── CustomOperationFilter (onCustomOperation)
│
├── 🏦 Financial Operations
│   ├── BalanceChangeFilter (onAccountsBalanceChange)
│   ├── ExchangeTransferFilter (onExchangeTransfer)
│   ├── InternalMarketFilter (onInternalMarketOperation)
│   ├── WhaleAlertFilter (onWhaleAlert)
│   ├── FeedPriceChangeFilter (onFeedPriceChange)
│   └── FeedPriceNoChangeFilter (onFeedPriceNoChange)
│
├── 🔐 Security & Governance
│   ├── AlarmFilter (onAlarm)
│   └── WitnessMissedBlocksFilter (onWitnessesMissedBlocks)
│
└── ⚙️ Blockchain Infrastructure
    ├── BlockNumberFilter (onBlockNumber)
    ├── BlockChangedFilter (onBlock)
    └── TransactionIdFilter (onTransactionIds)
```
