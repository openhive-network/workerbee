// WORK IN PROGRESS
import type { TAccountName, NaiAsset } from "@hiveio/wax";
import type { ITransactionSigner } from "./signing";

export type { NaiAsset };

/**
 * An object interface that defines a set of callback functions a user can use to get notified
 */
export interface Observer<T> {
  /**
   * A callback function that gets called by the producer during the subscription when
   * the producer "has" the `value`. It won't be called if `error` or `complete` callback
   * functions have been called, nor after the consumer has unsubscribed.
   */
  next: (value: T) => void;
  /**
   * A callback function that gets called by the producer if and when it encountered a
   * problem of any kind. The errored value will be provided through the `err` parameter.
   */
  error: (err: Error) => void;
  /**
   * A callback function that gets called by the producer if and when it has no more
   * values to provide (by calling `next` callback function).
   */
  complete: () => void;
}

export interface IPagination {
  page: number;
  pageSize: number;
}

export interface ICommonFilters {
  readonly startTime?: Date;
  readonly endTime?: Date;
  order?: "asc" | "desc";
}

export interface IVotesFilters extends ICommonFilters {
  readonly limit: number;
  readonly votesSort: "by_comment_voter" | "by_voter_comment";
}
export interface IPostFilters extends ICommonFilters {
  readonly sort:  "trending" | "hot" | "created" | "promoted" | "payout" | "payout_comments" | "muted";
  readonly tag: string;
}

export type AccountPostsSortOption = "blog" | "posts" | "comments" | "replies" | "feed";

export interface IAccountPostsFilters extends ICommonFilters {
  readonly sort: AccountPostsSortOption;
  readonly account: string;
}

export interface ICommunityFilters extends ICommonFilters {
  readonly sort: string;
  readonly query: string
}

export interface IAccountIdentity {
  readonly name: string;
}

export interface ICommunityIdentity {
  readonly name: string;
}

/**
 * Represents a set of data uniquely identifying a post or reply object.
 */
export interface IPostCommentIdentity {
  readonly author: string;
  readonly permlink: string;
}

export interface IVote {
  readonly weight: number;
  readonly upvote: boolean;
  readonly voter: string;
  readonly parentComment: IPostCommentIdentity
}

export interface ICommunity extends ICommunityIdentity {
  readonly title: string;
  readonly about: string;
  readonly admins: string[];
  readonly avatarUrl: string;
  readonly creationDate: Date;
  readonly subscribersCount: number;
  readonly authorsCount: number;
  readonly pendingCount: number;
  getSlug(): string;
}
/** Single manabar data */
export interface IManabar {
  readonly max: bigint;
  readonly current: bigint;
  readonly percent: number;
}

/** All manabars for an account */
export interface IAccountManabars {
  readonly upvote: IManabar;
  readonly downvote: IManabar;
  readonly rc: IManabar;
}

/** Profile stats from bridge.get_profile */
export interface IProfileStats {
  readonly followers: number;
  readonly following: number;
  readonly rank: number;
}

/** Profile metadata from bridge.get_profile */
export interface IProfileMetadata {
  readonly name?: string;
  readonly about?: string;
  readonly location?: string;
  readonly website?: string;
  readonly profileImage?: string;
  readonly coverImage?: string;
}

/** Raw profile metadata JSON structure from the API */
export interface IProfileMetadataJson {
  profile?: {
    name?: string;
    about?: string;
    location?: string;
    website?: string;
    profile_image?: string;
    cover_image?: string;
  };
}

/** Full profile data from bridge.get_profile */
export interface IProfile {
  readonly name: string;
  readonly created: string;
  readonly postCount: number;
  readonly reputation: number;
  readonly stats: IProfileStats;
  readonly metadata: IProfileMetadata;
}

/** Database account data for financial information */
export interface IDatabaseAccount {
  readonly name: string;
  /** Formatted string e.g. "123.456 HIVE" */
  readonly balance: string;
  /** Formatted string e.g. "45.678 HBD" */
  readonly hbdBalance: string;
  /** Raw NaiAsset for HP calculations */
  readonly vestingShares: NaiAsset;
  /** Raw NaiAsset for HP calculations */
  readonly delegatedVestingShares: NaiAsset;
  /** Raw NaiAsset for HP calculations */
  readonly receivedVestingShares: NaiAsset;
  readonly postCount: number;
  readonly curationRewards: number;
  readonly postingRewards: number;
}

/** Dynamic global properties for VESTS to HP conversion */
export interface IGlobalProperties {
  /** Raw NaiAsset for HP calculations */
  readonly totalVestingFundHive: NaiAsset;
  /** Raw NaiAsset for HP calculations */
  readonly totalVestingShares: NaiAsset;
}

/** Complete user data combining profile and financial information */
export interface IFullUserData {
  // From bridge.get_profile
  readonly name: string;
  readonly created: string;
  readonly postCount: number;
  readonly reputation: number;
  readonly stats: IProfileStats;
  readonly metadata: IProfileMetadata;

  // From database_api.find_accounts - financial data (formatted for display)
  readonly balance: string;
  readonly hbdBalance: string;
  readonly curationRewards: number;
  readonly postingRewards: number;

  // Calculated HP values (formatted strings e.g. "1234.567 HIVE")
  readonly hivePower: string;
  readonly effectiveHivePower: string;
}

/** Comment sort options */
export type CommentSortOption = "comments" | "replies";

/** Pagination cursor for cursor-based pagination */
export interface IPaginationCursor {
  startAuthor?: string;
  startPermlink?: string;
}

/** Paginated result */
export interface IPaginatedResult<T> {
  items: readonly T[];
  hasMore: boolean;
  nextCursor?: IPaginationCursor;
}

export interface IAccount extends IAccountIdentity {
  readonly creationDate: Date;
  readonly lastActivity: Date;
  readonly postCount: number;
  readonly registeredDate: Date;
  readonly description: string;
  readonly avatar: string;
  getSlug(): string;
  getManabars(): Promise<IAccountManabars>;
  getProfile(): Promise<IProfile>;
}

/**
 * Common representation of a post and reply objects
 */
export interface IComment extends IPostCommentIdentity {
  readonly publishedAt: Date;
  readonly updatedAt: Date;


  enumMentionedAccounts(): Promise<Iterable<string>>;
  enumVotes(filter: IVotesFilters, pagination: IPagination): Promise<Iterable<IVote>>;
  getContent(): Promise<string>;
  wasVotedByUser(userName: string): Promise<boolean>;
  getVotesCount(): Promise<number>;

  /**
   * Allows to generate a slug for the comment, which can be used in URLs or as a unique identifier.
   */
  getSlug(): string;
};

/**
 * Represents a reply to a post or another reply object.
 */
export interface IReply extends IComment {
  parent: IPostCommentIdentity;
  topPost: IPostCommentIdentity;
}

export interface ISession {

}

/**
 * Represents a post (article) published on the platform.
 */
export interface IPost extends IComment {
  title: string;
  summary: string;
  tags: string[];
  community?: ICommunityIdentity;
  communityTitle?: string;

  getCommentsCount(): Promise<number>;
  enumReplies(filter: ICommonFilters, pagination: IPagination): Promise<Iterable<IReply>>;
  getTitleImage(): string;
}

/**
 * Authenticated blogging platform interface.
 *
 * All operations use the configured signer for transaction signing.
 * The signer handles all complexity (Keychain popups, hb-auth dialogs, etc.).
 *
 * @example
 * ```typescript
 * const signer = new KeychainSigner("username", "posting");
 * const activePlatform = bloggingPlatform.authorize(signer);
 * await activePlatform.vote(post, 10000);
 * ```
 */
export interface IActiveBloggingPlatform {
  /**
   * The account performing actions
   */
  readonly account: TAccountName;

  /**
   * The signer used for all operations
   */
  readonly signer: ITransactionSigner;

  /**
   * Create a new post
   * @param body - Post body content (markdown)
   * @param tags - Tags for the post (first tag is primary category)
   * @param title - Post title
   * @param observer - Optional observer for optimistic UI updates
   */
  post(body: string, tags: string[], title: string, observer?: Partial<Observer<IPost>>): Promise<void>;

  /**
   * Reply to a post or comment
   * @param parent - The post or comment to reply to
   * @param body - Reply body content (markdown)
   * @param observer - Optional observer for optimistic UI updates
   */
  comment(parent: IPostCommentIdentity, body: string, observer?: Partial<Observer<IComment>>): Promise<void>;

  /**
   * Vote on a post or comment
   * @param postOrComment - The post or comment to vote on
   * @param weight - Vote weight from -10000 (full downvote) to 10000 (full upvote), 0 to remove vote
   * @param observer - Optional observer for optimistic UI updates
   */
  vote(postOrComment: IPostCommentIdentity, weight: number, observer?: Partial<Observer<IVote>>): Promise<void>;

  /**
   * Reblog (resteem) a post to your blog
   * @param post - The post to reblog
   */
  reblog(post: IPostCommentIdentity): Promise<void>;

  /**
   * Delete a post (only works if no votes/replies)
   * @param post - The post to delete
   */
  deletePost(post: IPostCommentIdentity): Promise<void>;

  /**
   * Edit an existing post
   * @param post - The post to edit
   * @param body - New body content
   * @param tags - New tags
   * @param title - New title
   * @param observer - Optional observer for optimistic UI updates
   */
  editPost(post: IPostCommentIdentity, body: string, tags: string[], title: string, observer?: Partial<Observer<IPost>>): Promise<void>;

  /**
   * Delete a comment (only works if no votes/replies)
   * @param comment - The comment to delete
   */
  deleteComment(comment: IPostCommentIdentity): Promise<void>;

  /**
   * Edit an existing comment
   * @param comment - The comment to edit
   * @param body - New body content
   * @param observer - Optional observer for optimistic UI updates
   */
  editComment(comment: IPostCommentIdentity, body: string, observer?: Partial<Observer<IComment>>): Promise<void>;

  /**
   * Follow a blog or subscribe to a community
   * @param target - The account or community to follow
   */
  follow(target: IAccountIdentity | ICommunityIdentity): Promise<void>;

  /**
   * Unfollow a blog or unsubscribe from a community
   * @param target - The account or community to unfollow
   */
  unfollow(target: IAccountIdentity | ICommunityIdentity): Promise<void>;

  /**
   * Mute an account (hide their content from your feed)
   * @param account - The account to mute
   */
  mute(account: IAccountIdentity): Promise<void>;

  /**
   * Unmute an account
   * @param account - The account to unmute
   */
  unmute(account: IAccountIdentity): Promise<void>;

  /**
   * Get account information
   * @param accountName - Account name to look up
   */
  getAccount(accountName: string): Promise<IAccount>;
}

/**
 * Read-only blogging platform interface for browsing content.
 *
 * Use `authorize(signer)` to get an authenticated platform for write operations.
 */
export interface IBloggingPlatform {
  /**
   * Current viewer context for personalized content (e.g., checking if user voted)
   */
  viewerContext: IAccountIdentity;

  /**
   * Get a specific post by author and permlink
   */
  getPost(postId: IPostCommentIdentity): Promise<IPost>;

  /**
   * Enumerate posts with filters (trending, hot, created, etc.)
   */
  enumPosts(filter: IPostFilters, pagination: IPagination): Promise<Iterable<IPost>>;

  /**
   * Enumerate posts for a specific account (blog, posts, comments, replies, feed)
   */
  enumAccountPosts(filter: IAccountPostsFilters, pagination: IPagination): Promise<Iterable<IPost>>;

  /**
   * Set the viewer context for personalized content
   */
  configureViewContext(accountName: IAccountIdentity): void;

  /**
   * Enumerate communities with filters
   */
  enumCommunities(filter: ICommunityFilters, pagination: IPagination): Promise<Iterable<ICommunity>>;

  /**
   * Get account information
   */
  getAccount(accountName: string): Promise<IAccount>;

  /**
   * Authorize the platform with a signer to enable write operations.
   *
   * The signer handles all transaction signing complexity (Keychain popups,
   * hb-auth password dialogs, etc.).
   *
   * @param signer - Transaction signer configured for the user
   * @returns Authenticated platform with write capabilities
   *
   * @example
   * ```typescript
   * // Browser with Keychain
   * const signer = new KeychainSigner("username", "posting");
   * const activePlatform = bloggingPlatform.authorize(signer);
   * await activePlatform.vote(post, 10000);
   *
   * // Node.js with Beekeeper
   * const signer = await BeekeeperSigner.create(wallet, "username", "posting", chain);
   * const activePlatform = bloggingPlatform.authorize(signer);
   * await activePlatform.post("Hello world!", ["blog"], "My First Post");
   * ```
   */
  authorize(signer: ITransactionSigner): IActiveBloggingPlatform;

  overwrittenGetTitleImage?: () => string;
  overwriteGetTitleImage(callback: () => string): void;
}

// UI integration with mock data

