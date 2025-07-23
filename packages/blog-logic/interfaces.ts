// WORK IN PROGRESS

interface ICommentPostIdentity {
  author: IAuthorIdentity;
  id: string;
}

interface IVote {
  weight: number;
  upvote: boolean;
  voter: string;
}

interface ICommunityIdentity {
  name: string;
  title: string;
}
interface ICommunity extends ICommunityIdentity {
  about: string;
  admins: string[];
  avatar_url: string;
  creation_date: Date;
  subscribers_count: number;
  authors_count: number;
  pending_count: number;
}

interface IAuthorIdentity {
  id: string;
  name: string;
  avatar: string;
  url: string;
}

interface IBlogUser extends IAuthorIdentity {
  creation_date: Date;
  comment_count: number;
  post_count: number;
  registered_date: Date;
  last_activity: Date;
  description: string;
}

interface ICommonPostCommentFunctions {
  enumComments: (filter: unknown, page: number) => Iterable<IComment>;
  enumMentionedAccounts: () => Iterable<IAuthorIdentity>;
  enumVotes: (filter: unknown, page: number) => Iterable<IVote>;
  getContent: () => string;
}


interface IComment extends ICommentPostIdentity, ICommonPostCommentFunctions {
  published_at: Date;
  updated_at: Date;
  url: string;
  slug: string;
}

interface ISession {

}


interface IPostProperties extends ICommentPostIdentity {
  title: string;
  slug: string;
  summary: string;
  tags: string[];
  community: ICommunityIdentity;
  published_at: Date;
  updated_at: Date;
  url: string;
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
