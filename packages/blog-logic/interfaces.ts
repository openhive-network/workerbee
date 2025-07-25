// WORK IN PROGRESS

import type { TAccountName, IOnlineSignatureProvider } from "@hiveio/wax";

interface IPagination {
  page: number;
  pageSize: number;
}

interface IFilters {
  // To be decided
}

/**
 * Represents a set of data uniquely identifying a post or reply object.
 */
interface ICommentIdentity {
  readonly author: IAuthorIdentity;
  readonly id: string;
}

interface IVote {
  readonly weight: number;
  readonly upvote: boolean;
  readonly voter: string;
}

interface ICommunityIdentity {
  readonly name: string;
}
interface ICommunity extends ICommunityIdentity {
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

interface IAuthorIdentity {
  readonly id: string;
}

interface IBlogUser extends IAuthorIdentity {
  readonly creationDate: Date;
  readonly commentCount: number;
  readonly postCount: number;
  readonly registeredDate: Date;
  readonly lastActivity: Date;
  readonly description: string;
  readonly avatar: string;
  readonly url: string;
  readonly name: string;
  getSlug(): string;
}

/**
 * Common representation of a post and reply objects 
 */
interface IComment extends ICommentIdentity {
  readonly publishedAt: Date;
  readonly updatedAt: Date;

  enumReplies(filter: IFilters, pagination: IPagination): Iterable<IReply>;
  enumMentionedAccounts(): Iterable<IAuthorIdentity>;
  enumVotes(filter: IFilters, pagination: IPagination): Iterable<IVote>;
  getContent(): string;

  /**
   * Allows to generate a slug for the comment, which can be used in URLs or as a unique identifier.
   */
  generateSlug(): string;
};

/**
 * Represents a reply to a post or another reply object.
 */
interface IReply extends IComment {
  readonly parent: ICommentIdentity;
}

interface ISession {

}

/**
 * Represents a post (article) published on the platform.
 */
interface IPost extends IComment {
  readonly title: string;
  readonly summary: string;
  readonly tags: string[];
  readonly community: ICommunityIdentity;

  getTitleImage(): string;
}

interface ILoginSession {
  readonly authenticatedAccount: TAccountName;
  readonly sessionId: string;

  logout(): Promise<void>
}

interface IAuthenticationProvider {
  login(account: TAccountName, signatureProvider: IOnlineSignatureProvider, directLogin: boolean, sessionTimeout: number): Promise<ILoginSession>;
}

interface IActiveBloggingPlatform {
  readonly session: ILoginSession;

  post(body: string, tags: string[], title?: string, communityId?: string): void;
  comment(postOrComment: ICommentIdentity, body: string, tags: string[], title?: string, communityId?: string): void;
  vote(postOrComment: ICommentIdentity, voter: string, upvote: boolean, weight: number): void;
  reblog(postOrComment: ICommentIdentity): void;
  deletePost(postOrComment: ICommentIdentity): void;
  editPost(postOrComment: ICommentIdentity, body: string, tags: string[], title?: string, communityId?: string): void;
  deleteComment(postOrComment: ICommentIdentity): void;
  editComment(postOrComment: ICommentIdentity, body: string, tags: string[], title?: string, communityId?: string): void;
}

interface IBloggingPlatform {
  enumPosts(filter: IFilters, pagination: IPagination): Iterable<IPost>;
  configureAccountContext(accontName: string): void;
  enumCommunities(filter: IFilters, pagination: IPagination): Iterable<ICommunity>

  authorize(provider: IAuthenticationProvider): Promise<IActiveBloggingPlatform>;
}
