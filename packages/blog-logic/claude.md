# Blog-Logic Package

## Overview

The `hive-blog-logic` package is a TypeScript library that simplifies working with Hive blockchain blogging data. It provides a clean, logical interface for developers to interact with blog-related entities like posts, replies, accounts, communities, and votes without directly dealing with complex blockchain API calls.

## Architecture

```
BloggingPlatform (public API facade)
    ↓
DataProvider (core data orchestration & caching)
    ↓
Entity Classes (Post, Reply, Comment, Account, Community, Vote)
    ↓
Utility Functions (formatting, pagination, calculations)
    ↓
Wax Chain Integration (API communication & retry logic)
```

## Dependencies

- **@hiveio/wax**: Core Hive blockchain library for chain interactions
- **@hiveio/wax-api-hafbe**: HAFBE REST API integration for extended data
- **@hiveio/wax-api-jsonrpc**: JSON-RPC API integration for bridge and database API calls

## Source Files

All source files are located directly in `packages/blog-logic/` (flat structure, no `src/` subdirectory).

### Entity Classes

| File | Class | Description |
|------|-------|-------------|
| `Post.ts` | `Post extends Comment` | Blog posts/articles with title, tags, community, summary, and image metadata |
| `Comment.ts` | `Comment` | Base class for posts and replies. Handles voting, mentions, and content retrieval |
| `Reply.ts` | `Reply extends Comment` | Nested replies tracking parent comment and top post |
| `Account.ts` | `Account` | User accounts with profile metadata, creation dates, manabar calculations |
| `Community.ts` | `Community` | Hive communities with admin info and subscriber counts |
| `Vote.ts` | `Vote` | Individual votes with weight (upvote/downvote) and voter info |

### Core Orchestration

| File | Class | Description |
|------|-------|-------------|
| `DataProvider.ts` | `DataProvider` | Central hub for data fetching, caching, and distribution. Manages multiple caches and implements retry logic |
| `BloggingPlatform.ts` | `BloggingPlatform` | Public API facade implementing `IBloggingPlatform`. Entry point for consumers |

### Infrastructure

| File | Description |
|------|-------------|
| `wax.ts` | Wax chain initialization with fallback endpoints, retry logic, and endpoint cycling |
| `utils.ts` | Asset utilities (formatting, parsing, VESTS-to-HP conversion) and display formatting (compact numbers, dates, reputation) |
| `errors.ts` | Custom `WorkerBeeError` class with optional originator field |
| `interfaces.ts` | All TypeScript interfaces for filters, entities, profiles, and platform API |
| `index.ts` | Main entry point exporting all public classes and types |

### Experimental

| File | Description |
|------|-------------|
| `optimistic_actions.ts` | Optimistic UI pattern for blockchain transactions (WIP) |
| `optimistic-actions-interfaces.ts` | Interfaces for optimistic action state management |

## Key Interfaces

### Filters

- `IPagination`: page, pageSize
- `ICommonFilters`: startTime, endTime, order (asc/desc)
- `IPostFilters`: sort (trending/hot/created/promoted/payout/muted), tag
- `IAccountPostsFilters`: sort (blog/posts/comments/replies/feed), account
- `ICommunityFilters`: sort, query
- `IVotesFilters`: limit, votesSort

### Identity

- `IPostCommentIdentity`: author, permlink (uniquely identifies posts/comments)
- `IAccountIdentity`: name
- `ICommunityIdentity`: name

### Entities

- `IComment`: publishedAt, updatedAt, author, permlink, votesCount, methods for mentions/votes/content
- `IPost extends IComment`: title, summary, tags, community, methods for title image and replies
- `IReply extends IComment`: parent, topPost references
- `IAccount`: name, creationDate, postCount, methods for manabars and profile
- `ICommunity`: name, title, about, admins, subscribersCount
- `IVote`: weight, upvote (boolean), voter, parentComment

### Profile/Account Data

- `IProfile`: name, created, postCount, reputation, stats, metadata
- `IDatabaseAccount`: balances, vesting shares, rewards
- `IFullUserData`: Combined profile + financial data + calculated HP values
- `IAccountManabars`: upvote, downvote, rc (each as IManabar with max/current/percent)

## Data Flow

```
User Code → BloggingPlatform
    ├→ getPost() → Post instance
    ├→ enumPosts() → Iterable<Post>
    ├→ enumAccountPosts() → Iterable<Post>
    ├→ enumCommunities() → Iterable<Community>
    └→ getAccount() → Account instance

BloggingPlatform → DataProvider
    ├→ fetchPost() ← chain.api.bridge.get_post()
    ├→ enumPosts() ← chain.api.bridge.get_ranked_posts()
    ├→ enumAccountPosts() ← chain.api.bridge.get_account_posts()
    ├→ enumReplies() ← chain.api.bridge.get_discussion()
    ├→ fetchAccount() ← chain.api.database_api.find_accounts()
    ├→ enumCommunities() ← chain.api.bridge.list_communities()
    ├→ enumVotes() ← chain.api.database_api.list_votes()
    ├→ getProfile() ← chain.api.bridge.get_profile()
    └→ getDatabaseAccount() ← chain.api.database_api.find_accounts()
```

## Caching Strategy

DataProvider maintains multiple in-memory caches:

- `comments`: Map<string, PostBridgeApi>
- `repliesByPostId`: Map<string, IPostCommentIdentity[]>
- `accounts`: Map<string, HafbeTypesAccount>
- `communities`: Map<string, CommunityData>
- `votesByCommentsAndVoter`: Map<string, Map<string, ActiveVotesDatabaseApi>>

Cache keys use hash format: `author_permlink`

## Usage

```typescript
import { BloggingPlatform, DataProvider, getWax } from "hive-blog-logic";

// Initialize chain
const chain = await getWax();

// Create data provider and platform
const dataProvider = new DataProvider(chain);
const platform = new BloggingPlatform(dataProvider);

// Fetch a post
const post = await platform.getPost({ author: "username", permlink: "post-permlink" });

// Enumerate trending posts (filter and pagination are separate arguments)
const posts = await platform.enumPosts({ sort: "trending" }, { page: 1, pageSize: 20 });
for (const post of posts) {
  console.log(post.title);
}

// Get account (takes username string directly)
const account = await platform.getAccount("username");
const manabars = await account.getManabars();
```

## Technical Characteristics

- **Module Type**: ES modules (`"type": "module"`)
- **Resilience**: Automatic endpoint fallback with configurable retry logic (3 retries)
- **Lazy Loading**: Entities fetch data on-demand from DataProvider
- **Pagination**: Supports both offset-based and cursor-based pagination
- **ViewerContext**: Optional observer account for tracking voting/following status

## Coding Conventions

- Entity classes extend from base `Comment` class
- All public interfaces prefixed with `I`
- Filter interfaces follow pattern `I{Entity}Filters`
- Identity interfaces follow pattern `I{Entity}Identity`
- Async generators used for enumeration methods (`enum*`)
- Hash-based cache keys: `${author}_${permlink}`

## Error Handling

Use `WorkerBeeError` for domain-specific errors:

```typescript
import { WorkerBeeError } from "./errors";

throw new WorkerBeeError("Error message", optionalOriginator);
```

## Utility Functions

### Pagination

- `paginateData(data, pagination)`: Paginate an array based on page/pageSize

### Chain-dependent (require Wax instance)

- `parseAssetWithChain(chain, asset)`: Parse a NaiAsset to its numeric value
- `formatAsset(chain, asset)`: Format a NaiAsset to display string (e.g., "123.456 HIVE")
- `getAssetAmount(chain, asset)`: Get asset amount as string without symbol
- `getAssetSymbol(chain, asset)`: Get asset symbol (e.g., "HIVE")
- `vestsToHpAsset(chain, vests, totalVestingFundHive, totalVestingShares)`: Convert VESTS to HP as NaiAsset
- `vestsToHpNumber(chain, vests, totalVestingFundHive, totalVestingShares)`: Convert VESTS to HP as number
- `calculateEffectiveHpAsset(chain, vests, delegated, received, totalFund, totalShares)`: Calculate effective HP as NaiAsset
- `calculateEffectiveHpNumber(chain, vests, delegated, received, totalFund, totalShares)`: Calculate effective HP as number

### Standalone (no chain required)

- `parseNaiAsset(asset)`: Parse a NaiAsset to numeric value
- `parseFormattedAsset(formattedAsset)`: Parse formatted string like "123.456 HIVE" to number
- `stripAssetSuffix(amount)`: Remove currency suffix from formatted string
- `convertVestsToHP(vests, globalProps)`: Convert VESTS to HP using global properties
- `calculateEffectiveHP(vests, delegated, received, globalProps)`: Calculate effective HP (own + received - delegated)

### Display Formatting

- `formatCompactNumber(num)`: Format large numbers with K/M suffix (e.g., 12500 → "12.5K")
- `formatNumber(num, decimals)`: Format number with locale and fixed decimals
- `formatJoinDate(dateStr)`: Format date string to readable format (e.g., "Mar 2016")
- `formatReputation(rep)`: Floor reputation score to integer
