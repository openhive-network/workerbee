// WORK IN PROGRESS

interface IPagination {
  page: number;
  page_size: number;
}

interface IFilters {
  // To be decided
}

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
  readonly title: string;
}
interface ICommunity extends ICommunityIdentity {
  readonly about: string;
  readonly admins: string[];
  readonly avatar_url: string;
  readonly creation_date: Date;
  readonly subscribers_count: number;
  readonly authors_count: number;
  readonly pending_count: number;
  getSlug: () => string;
}

interface IAuthorIdentity {
  readonly id: string;
  readonly name: string;
  readonly avatar: string;
  readonly url: string;
}

interface IBlogUser extends IAuthorIdentity {
  readonly creation_date: Date;
  readonly comment_count: number;
  readonly post_count: number;
  readonly registered_date: Date;
  readonly last_activity: Date;
  readonly description: string;
  getSlug: () => string;
}

/**
 * Common representation of a post and reply objects 
 */
interface IComment extends ICommentIdentity {
  enumReplies(filter: IFilters, pagination: IPagination): Iterable<IReply>;
  enumMentionedAccounts: () => Iterable<IAuthorIdentity>;
  enumVotes: (filter: IFilters, pagination: IPagination) => Iterable<IVote>;
  getContent: () => string;
}


interface IReply extends IComment {
  readonly published_at: Date;
  readonly updated_at: Date;
  readonly url: string;
  getSlug: () => string;
}

interface ISession {

}


interface IPostProperties extends ICommentIdentity {
  readonly title: string;
  readonly summary: string;
  readonly tags: string[];
  readonly community: ICommunityIdentity;
  readonly published_at: Date;
  readonly updated_at: Date;
  readonly url: string;
}

interface IPost extends IPostProperties, IComment {
  getTitleImage: () => string;
  getSlug: () => string;
}

interface IPostCommentCreationRequirements {
  readonly body: string;
  readonly title?: string;
  readonly community_id?: string;
  readonly tags: string[];
}

interface IActiveBloggingPlatform {
  post: (post_data: IPostCommentCreationRequirements) => void;
  comment: (post_or_comment: ICommentIdentity, comment_data: IPostCommentCreationRequirements) => void;
  vote: (post_or_comment: ICommentIdentity, voter: string, upvote: boolean, weight: number) => void;
  reblog: (post_or_comment: ICommentIdentity) => void;
  delete_post: (post_or_comment: ICommentIdentity) => void;
  edit_post: (post_or_comment: ICommentIdentity, post_data: IPostCommentCreationRequirements) => void;
  delete_comment: (post_or_comment: ICommentIdentity) => void;
  edit_comment: (post_or_comment: ICommentIdentity, post_data: IPostCommentCreationRequirements) => void;
}

interface BloggingPlatform {
  enumPosts: (filter: IFilters, pagination: IPagination) => Iterable<IPost>;
  configureAccountContext: (accont_name: string) => void;
  enumCommunities: (filter: IFilters, pagination: IPagination) => Iterable<ICommunity>
  authorize(provider: unknown);
}
