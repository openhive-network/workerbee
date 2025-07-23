// WORK IN PROGRESS

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
  enumComments: (filter: unknown, page: number) => Iterable<IComment>;
  enumMentionedAccounts: () => Iterable<IAuthorIdentity>;
  enumVotes: (filter: unknown, page: number) => Iterable<IVote>;
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
  getSlug: () => string;
  readonly summary: string;
  readonly tags: string[];
  readonly community: ICommunityIdentity;
  readonly published_at: Date;
  readonly updated_at: Date;
  readonly url: string;
}

interface IPost extends IPostProperties, ICommonPostCommentFunctions {
  getTitleImage: () => string;
}

interface IActiveBloggingPlatform {
  post: (post_data: IPost) => void;
  comment: (post: string, comment_data: IComment) => void;
  vote: (post: string) => void;
  reblog: (post: string) => void;
}

interface BloggingPlatform {
  enumPosts: (filter: unknown, page: number) => Iterable<IPost>;
  configureAccountContext: (accont_name: string) => void;
  authorize(provider: unknown);
}
