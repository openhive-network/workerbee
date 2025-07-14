# Test Plan - Complex WorkerBee Usage Scenarios

## Individual Filter Verification Scenarios

### 1. onPosts Filter Tests

#### 1.1 onPosts Positive Cases
```typescript
// Multiple accounts - should trigger when any specified account creates post
bot.observe.onPosts("author1", "author2", "author3")

// Simultaneous posts - should trigger for all accounts posting in same block
bot.observe.onPosts("author1", "author2") // Both post in block N
```

#### 1.2 onPosts Negative Cases
```typescript
// Should NOT trigger when account creates comment
bot.observe.onPosts("test-author") // test-author creates comment, not post

// Multiple accounts - should NOT trigger when any specified account creates comment, not post
bot.observe.onPosts("author1", "author2", "author3")

// Monitor for posts from a specific account - should NOT trigger as the account created no posts
bot.observe.onPosts("nonexistent-account")

// Should handle empty account list
bot.observe.onPosts()
```

### 2. onComments Filter Tests

#### 2.1 onComments Positive Cases
```typescript
// Multiple accounts - should trigger when any specified account creates comment
bot.observe.onComments("commenter1", "commenter2", "commenter3")

// Simultaneous comments - should trigger for all accounts commenting in same block
bot.observe.onComments("commenter1", "commenter2") // Both comment in block N
```

#### 2.2 onComments Negative Cases
```typescript
// Should NOT trigger when account creates post
bot.observe.onComments("test-commenter") // test-commenter creates post, not comment

// Multiple accounts - should NOT trigger when any specified account creates post, not comment
bot.observe.onComments("author1", "author2", "author3")

// Monitor for comments from a specific account - should NOT trigger as the account created no comments
bot.observe.onComments("nonexistent-account")

// Should handle empty account list
bot.observe.onComments()
```

#### 2.3 onPosts and onComments cases
```typescript
// Multiple accounts - should trigger when any specified account creates post or comment
bot.observe.onComments("test-commenter").or.onPosts("test-poster")
```

### 3. onVotes Filter Tests

#### 3.1 onVotes Positive Cases
```typescript
// Multiple voters - should trigger when any specified account votes
bot.observe.onVotes("voter1", "voter2", "voter3")

// Simultaneous votes - should trigger for all accounts voting in same block
bot.observe.onVotes("voter1", "voter2") // Both vote in block N
```

#### 3.2 onVotes Negative Cases
```typescript
// Should NOT trigger when account creates post/comment
bot.observe.onVotes("test-voter") // test-voter posts or comments, doesn't vote

// Should NOT trigger when different account votes
bot.observe.onVotes("voter1") // voter2 votes, not voter1

// Monitor for votes from a specific account - should NOT trigger as the account did not vote
bot.observe.onVotes("nonexistent-account")

// Should handle empty account list
bot.observe.onVotes()
```

## Realistic Test Scenarios

### 1. Scenarios with OR operator

#### 1.1 Multi-Author Content Monitor
```typescript
// Monitors posts OR comments from multiple authors
bot.observe.onPosts("author1").or.onPosts("author2").or.onComments("author1")
```

#### 1.2 Social Activity Aggregator
```typescript
// Tracks various types of social activity
bot.observe.onVotes("curator").or.onFollow("influencer").or.onReblog("curator")
```

#### 1.3 Financial Activity Monitor
```typescript
// Monitors financial activity
bot.observe.onWhaleAlert(hiveCoins(1000)).or.onInternalMarketOperation().or.onExchangeTransfer()
```

#### 1.4 Content Engagement Tracker
```typescript
// Tracks content engagement
bot.observe.onMention("brand").or.onPosts("brand").or.onReblog("brand")
```

#### 1.5 Cross-Platform Activity Monitor
```typescript
// Monitors activity across different platforms and operations
bot.observe.onCustomOperation("follow")
  .or.onCustomOperation("reblog")
  .or.onNewAccount()
  .or.onAlarm("monitored-account")
```

#### 1.6 Content Creator Dashboard
```typescript
// Comprehensive content creator monitoring
bot.observe.onPosts("creator")
  .or.onComments("creator")
  .or.onMention("creator")
  .or.onReblog("creator")
  .or.onVotes("creator")
```

#### 1.7 Market Movement Detector
```typescript
// Detects significant market movements
bot.observe.onFeedPriceChange(3)
  .or.onWhaleAlert(hiveCoins(10000))
  .or.onInternalMarketOperation()
  .or.onExchangeTransfer()
```

#### 1.8 Witness Reliability Monitor
```typescript
// Monitors witness performance and reliability
bot.observe.onWitnessesMissedBlocks(5, "witness1")
  .or.onWitnessesMissedBlocks(5, "witness2")
  .or.onFeedPriceNoChange(48)
```

### 2. Historical Data Scenarios

#### 2.1 Pattern Analysis Bot
```typescript
// Analyzes voting patterns in the past
bot.providePastOperations(startBlock, endBlock)
  .onVotes("whale")
  .or.onPosts("whale")
  .provideManabarData(EManabarType.RC, "whale")
```

#### 2.2 Market Trend Analyzer
```typescript
// Analyzes market trends from the past
bot.providePastOperations("-30d")
  .onWhaleAlert(hiveCoins(5000))
  .or.onInternalMarketOperation()
  .provideBlockData()
```

#### 2.3 Community Growth Monitor
```typescript
// Monitors community growth
bot.providePastOperations(startBlock, endBlock)
  .onNewAccount()
  .or.onFollow("community-account")
  .or.onCustomOperation("follow")
```

#### 2.4 Content Performance Analyzer
```typescript
// Analyzes content performance over time
bot.providePastOperations("-14d")
  .onPosts("top-author")
  .or.onComments("top-author")
  .or.onVotes("top-author")
  .provideAccounts("top-author")
  .provideManabarData(EManabarType.UPVOTE, "top-author")
```

#### 2.5 Economic Activity Tracker
```typescript
// Tracks economic activity patterns
bot.providePastOperations(recentBlocks)
  .onWhaleAlert(hiveCoins(1000))
  .or.onExchangeTransfer()
  .or.onInternalMarketOperation()
  .provideBlockData()
  .provideFeedPriceData()
```

#### 2.6 Account Behavior Analysis
```typescript
// Analyzes account behavior patterns
bot.providePastOperations("-7d")
  .onPosts("analyzed-account")
  .or.onVotes("analyzed-account")
  .or.onFollow("analyzed-account")
  .or.onReblog("analyzed-account")
  .provideAccounts("analyzed-account")
```

### 3. Live Monitoring Scenarios

#### 3.1 Real-time Social Dashboard
```typescript
// Real-time activity dashboard
bot.observe.onPosts("featured-author")
  .or.onComments("featured-author")
  .or.onVotes("featured-author")
  .provideAccounts("featured-author")
  .provideManabarData(EManabarType.RC, "featured-author")
```

#### 3.2 Account Health Monitor
```typescript
// Monitors account "health"
bot.observe.onAccountsBalanceChange(false, "monitored-account")
  .or.onAccountsMetadataChange("monitored-account")
  .or.onAccountsManabarPercent(EManabarType.RC, 20, "monitored-account")
```

#### 3.3 Market Alert System
```typescript
// Market alert system
bot.observe.onFeedPriceChange(5)
  .or.onFeedPriceNoChange(24)
  .or.onWitnessesMissedBlocks(10, "witness")
  .provideFeedPriceData()
```

#### 3.4 Community Moderation Bot (TODO after `onCommunityPost` implementation)
```typescript
// Community moderation monitoring
bot.observe.onPosts("community-tag")
  .or.onComments("moderator-account")
  .or.onCustomOperation("community")
  .or.onMention("community-account")
```

#### 3.5 Investment Portfolio Monitor
```typescript
// Monitors investment portfolio activities
bot.observe.onAccountsBalanceChange(true, "investor1", "investor2")
  .or.onWhaleAlert(hiveCoins(5000))
  .or.onExchangeTransfer()
  .provideAccounts("investor1", "investor2")
```

#### 3.6 Content Aggregation Service
```typescript
// Aggregates content from multiple sources
bot.observe.onPosts("news-account1")
  .or.onPosts("news-account2")
  .or.onReblog("aggregator-account")
```

#### 3.7 Engagement Optimization Bot
```typescript
// Optimizes engagement timing
bot.observe.onAccountsManabarPercent(EManabarType.UPVOTE, 90, "curator")
  .or.onPosts("target-author")
  .or.onComments("target-author")
  .provideManabarData(EManabarType.UPVOTE, "curator")
```

### 4. Complex Scenarios with Providers

#### 4.1 Complete Account Analysis
```typescript
// Complete account analysis with all data
bot.observe.onBlock()
  .provideAccounts("target-account")
  .provideRcAccounts("target-account")
  .provideManabarData(EManabarType.RC, "target-account")
  .provideManabarData(EManabarType.UPVOTE, "target-account")
  .provideBlockData()
  .provideFeedPriceData()
```

#### 4.2 Multi-Account Comparison
```typescript
// Multi-account comparison
bot.observe.onBlock()
  .provideAccounts("account1", "account2", "account3")
  .provideManabarData(EManabarType.RC, "account1", "account2", "account3")
  .provideWitnesses("witness1", "witness2")
```

#### 4.3 Comprehensive Market Analysis
```typescript
// Full market data analysis
bot.observe.onBlock()
  .or.onInternalMarketOperation()
  .or.onExchangeTransfer()
  .provideBlockData()
  .provideFeedPriceData()
  .provideAccounts("major-trader1", "major-trader2")
```

#### 4.4 Social Network Analysis
```typescript
// Social network relationship analysis
bot.observe.onFollow("influencer1")
  .or.onFollow("influencer2")
  .or.onReblog("influencer1")
  .or.onMention("influencer1")
  .provideAccounts("influencer1", "influencer2")
  .provideManabarData(EManabarType.RC, "influencer1", "influencer2")
```

#### 4.5 Content Performance Dashboard
```typescript
// Comprehensive content performance monitoring
bot.observe.onPosts("content-creator")
  .or.onComments("content-creator")
  .or.onVotes("content-creator")
  .or.onReblog("content-creator")
  .provideAccounts("content-creator")
  .provideManabarData(EManabarType.UPVOTE, "content-creator")
  .provideBlockData()
```

#### 4.6 Governance Monitoring System
```typescript
// Monitors governance-related activities
bot.observe.onWitnessesMissedBlocks(3, "witness1", "witness2")
  .or.onFeedPriceChange(2)
  .or.onCustomOperation("witness_set_properties")
  .provideWitnesses("witness1", "witness2")
  .provideFeedPriceData()
```

### 5. Performance and Scalability Testing

#### 5.1 High-Volume Transaction Monitor
```typescript
// Monitor large number of transactions
bot.providePastOperations(largeDaysRange)
  .onTransactionIds(...manyTransactionIds)
  .provideBlockData()
```

#### 5.2 Multi-Filter Performance Test
```typescript
// Performance test with multiple filters
bot.observe.onPosts("author1")
  .or.onPosts("author2")
  .or.onComments("author1")
  .or.onComments("author2")
  .or.onVotes("author1")
  .or.onVotes("author2")
```

#### 5.3 Massive Account Monitoring
```typescript
// Monitoring large number of accounts
bot.observe.onAccountsBalanceChange(false, ...hundredsOfAccounts)
  .or.onAccountsMetadataChange(...hundredsOfAccounts)
  .provideAccounts(...hundredsOfAccounts)
```

#### 5.4 High-Frequency Event Processing
```typescript
// Processing high-frequency events
bot.observe.onBlock()
  .or.onVotes("high-activity-curator")
  .or.onComments("popular-author")
  .or.onInternalMarketOperation()
  .provideBlockData()
```

#### 5.5 Long-Running Historical Analysis
```typescript
// Long-running analysis of historical data
bot.providePastOperations("-365d")
  .onWhaleAlert(hiveCoins(1000))
  .or.onPosts("long-term-author")
  .or.onExchangeTransfer()
  .provideBlockData()
```

### 6. Advanced Use Cases

#### 6.1 Economic Research Platform
```typescript
// Economic research data collection
bot.observe.onWhaleAlert(hiveCoins(10000))
  .or.onFeedPriceChange(1)
  .or.onInternalMarketOperation()
  .or.onExchangeTransfer()
  .provideFeedPriceData()
  .provideBlockData()
```

#### 6.2 Content Recommendation Engine
```typescript
// Content recommendation data gathering
bot.observe.onPosts("popular-tag")
  .or.onReblog("aggregator-accounts")
  .or.onVotes("quality-curators")
  .or.onMention("trending-topics")
  .provideAccounts("popular-authors")
```

#### 6.3 Automated Trading Signal Generator
```typescript
// Generating trading signals from blockchain activity
bot.observe.onWhaleAlert(hiveCoins(50000))
  .or.onFeedPriceChange(3)
  .or.onWitnessesMissedBlocks(5, "top-witnesses")
  .or.onInternalMarketOperation()
  .provideFeedPriceData()
  .provideWitnesses("top-witnesses")
```

### 7. Edge Cases and Stress Testing

#### 7.1 Multiple OR Chaining Test
```typescript
// Testing extreme OR chaining
bot.observe.onPosts("author1")
  .or.onPosts("author2")
  .or.onPosts("author3")
  .or.onPosts("author4")
  .or.onComments("author1")
  .or.onComments("author2")
  .or.onVotes("curator1")
  .or.onVotes("curator2")
  .or.onFollow("influencer")
  .or.onReblog("aggregator")
```

#### 7.2 Repeated OR Operations Test
```typescript
// Testing repeated .or.or.or.or operations
bot.observe.onBlock()
  .or.or.or.or.onPosts("test-author")
  .provideBlockData()
```

#### 7.3 Duplicate Provider Calls Test
```typescript
// Testing duplicate provider calls with same arguments
bot.observe.onBlock()
  .provideAccounts("gtg")
  .provideAccounts("gtg")
  .provideAccounts("gtg")
  .provideAccounts("gtg")
  .provideManabarData(EManabarType.RC, "gtg")
  .provideManabarData(EManabarType.RC, "gtg")
  .provideManabarData(EManabarType.RC, "gtg")
  .provideBlockData()
  .provideBlockData()
  .provideBlockData()
```

#### 7.4 AND Logic Simulation
```typescript
// Posts AND manabar check
const observer1 = bot.observe.onPosts("target-author").onAccountsFullManabar(EManabarType.UPVOTE, "target-author");
```

#### 7.5 Provider Type Duplication Test
```typescript
// Testing same provider types with different arguments
bot.observe.onBlock()
  .provideAccounts("account1")
  .provideAccounts("account2")
  .provideAccounts("account3")
  .provideManabarData(EManabarType.RC, "account1")
  .provideManabarData(EManabarType.UPVOTE, "account1")
  .provideManabarData(EManabarType.DOWNVOTE, "account1")
  .provideManabarData(EManabarType.RC, "account2")
```

#### 7.6 Complex Nested Filter Combinations
```typescript
// Complex combination of multiple filter types
bot.observe.onPosts("author1")
  .or.onComments("author1")
  .or.onVotes("author1")
  .or.onFollow("author1")
  .or.onReblog("author1")
  .or.onMention("author1")
  .or.onWhaleAlert(hiveCoins(1000))
  .or.onInternalMarketOperation()
  .or.onExchangeTransfer()
  .or.onNewAccount()
  .or.onCustomOperation("follow")
  .or.onAccountsBalanceChange(false, "author1")
  .or.onAccountsMetadataChange("author1")
  .or.onFeedPriceChange(2)
  .provideAccounts("author1")
  .provideManabarData(EManabarType.RC, "author1")
  .provideBlockData()
  .provideFeedPriceData()
```

#### 7.7 Double Subscribe Prevention Test
```typescript
// Testing prevention of double subscribe
const observer = bot.observe.onPosts("test-author");

// First subscribe
const subscription1 = observer.subscribe({
  next(data) { console.log("First subscription"); }
});

// Attempt second subscribe (should be prevented or handled gracefully)
try {
  const subscription2 = observer.subscribe({
    next(data) { console.log("Second subscription - should not work"); }
  });
  // This should either throw an error or be handled gracefully
} catch (error) {
  console.log("Double subscribe prevented:", error.message);
}
```

#### 7.8 Resource Cleanup Stress Test
```typescript
// Testing proper cleanup under stress
const observers = [];
for (let i = 0; i < 100; i++) {
  const observer = bot.observe.onPosts(`author${i}`)
    .or.onComments(`author${i}`)
    .provideAccounts(`author${i}`);

  observers.push(observer);
}

// Cleanup all observers
observers.forEach(observer => observer.unsubscribe());
```

#### 7.9 Concurrent Observer Test
```typescript
// Testing multiple concurrent observers
const observer1 = bot.observe.onPosts("author1").provideAccounts("author1");
const observer2 = bot.observe.onComments("author2").provideAccounts("author2");
const observer3 = bot.observe.onVotes("curator").provideManabarData(EManabarType.RC, "curator");

// All should work simultaneously without interference
Promise.all([
  new Promise(resolve => observer1.subscribe({ next: resolve })),
  new Promise(resolve => observer2.subscribe({ next: resolve })),
  new Promise(resolve => observer3.subscribe({ next: resolve }))
]);
```
