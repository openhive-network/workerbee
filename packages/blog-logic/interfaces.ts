// WORK IN PROGRESS

import type { TAccountName, IOnlineSignatureProvider } from "@hiveio/wax";

interface IPagination {
  page: number;
  page_size: number;
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
  readonly avatar_url: string;
  readonly creation_date: Date;
  readonly subscribers_count: number;
  readonly authors_count: number;
  readonly pending_count: number;
  getSlug(): string;
}

interface IAuthorIdentity {
  readonly id: string;
}

interface IBlogUser extends IAuthorIdentity {
  readonly creation_date: Date;
  readonly comment_count: number;
  readonly post_count: number;
  readonly registered_date: Date;
  readonly last_activity: Date;
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
  readonly published_at: Date;
  readonly updated_at: Date;

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

interface IPostCommentCreationRequirements {
  readonly body: string;
  readonly title?: string;
  readonly community_id?: string;
  readonly tags: string[];
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

  post(post_data: IPostCommentCreationRequirements): void;
  comment(post_or_comment: ICommentIdentity, comment_data: IPostCommentCreationRequirements): void;
  vote(post_or_comment: ICommentIdentity, voter: string, upvote: boolean, weight: number): void;
  reblog(post_or_comment: ICommentIdentity): void;
  delete_post(post_or_comment: ICommentIdentity): void;
  edit_post(post_or_comment: ICommentIdentity, post_data: IPostCommentCreationRequirements): void;
  delete_comment(post_or_comment: ICommentIdentity): void;
  edit_comment(post_or_comment: ICommentIdentity, post_data: IPostCommentCreationRequirements): void;
}

interface IBloggingPlatform {
  enumPosts(filter: IFilters, pagination: IPagination): Iterable<IPost>;
  configureAccountContext(accont_name: string): void;
  enumCommunities(filter: IFilters, pagination: IPagination): Iterable<ICommunity>

  authorize(provider: IAuthenticationProvider): Promise<IActiveBloggingPlatform>;
}
