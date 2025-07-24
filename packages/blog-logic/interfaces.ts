// WORK IN PROGRESS

interface IStandardPagination {
  page: number;
  page_size: number;
}

interface IFilters {
  // To be decided
}

interface ICommentPostIdentity {
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

interface ICommonPostCommentFunctions {
  enumComments: (filter: IFilters, pagination: IStandardPagination) => Iterable<IComment>;
  enumMentionedAccounts: () => Iterable<IAuthorIdentity>;
  enumVotes: (filter: IFilters, pagination: IStandardPagination) => Iterable<IVote>;
  getContent: () => string;
}


interface IComment extends ICommentPostIdentity, ICommonPostCommentFunctions {
  readonly published_at: Date;
  readonly updated_at: Date;
  readonly url: string;
  getSlug: () => string;
}

interface ISession {

}


interface IPostProperties extends ICommentPostIdentity {
  readonly title: string;
  readonly summary: string;
  readonly tags: string[];
  readonly community: ICommunityIdentity;
  readonly published_at: Date;
  readonly updated_at: Date;
  readonly url: string;
}

interface IPost extends IPostProperties, ICommonPostCommentFunctions {
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
  comment: (post_or_comment: ICommentPostIdentity, comment_data: IPostCommentCreationRequirements) => void;
  vote: (post_or_comment: ICommentPostIdentity, voter: string, upvote: boolean, weight: number) => void;
  reblog: (post_or_comment: ICommentPostIdentity) => void;
  delete_post: (post_or_comment: ICommentPostIdentity) => void;
  edit_post: (post_or_comment: ICommentPostIdentity, post_data: IPostCommentCreationRequirements) => void;
  delete_comment: (post_or_comment: ICommentPostIdentity) => void;
  edit_comment: (post_or_comment: ICommentPostIdentity, post_data: IPostCommentCreationRequirements) => void;
}

interface BloggingPlatform {
  enumPosts: (filter: IFilters, pagination: IStandardPagination) => Iterable<IPost>;
  configureAccountContext: (accont_name: string) => void;
  enumCommunities: (filter: IFilters, pagination: IStandardPagination) => Iterable<ICommunity>
  authorize(provider: unknown);
}
