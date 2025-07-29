// WORK IN PROGRESS
import type { TAccountName, IOnlineSignatureProvider } from "@hiveio/wax";

export interface IPagination {
  page: number;
  pageSize: number;
}

export interface ICommonFilters {
  readonly startTime?: Date;
  readonly endTime?: Date;
}

export interface IVotesFilters extends ICommonFilters {
  // To be decided
}

export interface IPostCommentsFilters extends ICommonFilters {
  // To be decided
}

export interface ICommunityFilters extends ICommonFilters {
  readonly byName?: string;
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
  readonly author: IAccountIdentity;
  readonly id: string;
}

export interface IVote {
  readonly weight: number;
  readonly upvote: boolean;
  readonly voter: string;
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
export interface IAccount extends IAccountIdentity {
  readonly creationDate: Date;
  readonly commentCount: number;
  readonly lastActivity: Date;
  readonly postCount: number;
  readonly registeredDate: Date;
  readonly description: string;
  readonly avatar: string;
  readonly url: string;
  readonly name: string;
  getSlug(): string;
}

/**
 * Common representation of a post and reply objects
 */
export interface IComment extends IPostCommentIdentity {
  readonly publishedAt: Date;
  readonly updatedAt: Date;
  readonly author: IAccountIdentity;

  enumReplies(filter: IFilters, pagination: IPagination): Iterable<IReply>;
  enumMentionedAccounts(): Iterable<IAccount>;
  enumVotes(filter: IFilters, pagination: IPagination): Iterable<IVote>;
  getContent(): string;
  wasVotedByUser(userName: IAccountIdentity): boolean;
  getCommensCount(): number;

  /**
   * Allows to generate a slug for the comment, which can be used in URLs or as a unique identifier.
   */
  generateSlug(): string;
};

/**
 * Represents a reply to a post or another reply object.
 */
export interface IReply extends IComment {
  readonly parent: IPostCommentIdentity;
}

export interface ISession {

}

/**
 * Represents a post (article) published on the platform.
 */
export interface IPost extends IComment {
  readonly title: string;
  readonly summary: string;
  readonly tags: string[];
  readonly community?: ICommunityIdentity;

  getTitleImage(): string;
}

export interface ILoginSession {
  readonly authenticatedAccount: TAccountName;
  readonly sessionId: string;

  logout(): Promise<void>
}

export interface IAuthenticationProvider {
  login(account: TAccountName, signatureProvider: IOnlineSignatureProvider, directLogin: boolean, sessionTimeout: number): Promise<ILoginSession>;
}

export interface IActiveBloggingPlatform {
  readonly session: ILoginSession;

  post(body: string, tags: string[], title?: string, communityId?: string): Promise<boolean>;
  comment(postOrComment: IPostCommentIdentity, body: string, tags: string[], title?: string, communityId?: string): Promise<boolean>;
  vote(postOrComment: IPostCommentIdentity, voter: string, upvote: boolean, weight: number): Promise<boolean>;
  reblog(postOrComment: IPostCommentIdentity): Promise<boolean>;
  deletePost(postOrComment: IPostCommentIdentity): Promise<boolean>;
  editPost(postOrComment: IPostCommentIdentity, body: string, tags: string[], title?: string, communityId?: string): Promise<boolean>;
  deleteComment(postOrComment: IPostCommentIdentity): Promise<boolean>;
  editComment(postOrComment: IPostCommentIdentity, body: string, tags: string[], title?: string, communityId?: string): Promise<boolean>;
  followBlog(authorOrCommunity: IAccountIdentity | ICommunityIdentity): Promise<boolean>;
}

export interface IBloggingPlatform {
  enumPosts(filter: IFilters, pagination: IPagination): Iterable<IPost>;
  configureAccountContext(accontName: string): void;
  enumCommunities(filter: IFilters, pagination: IPagination): Iterable<ICommunity>

  authorize(provider: IAuthenticationProvider): Promise<IActiveBloggingPlatform>;
}
