// WORK IN PROGRESS

interface IVote {
  weight: number;
  upvote: boolean;
  voter: string;
}

interface ICommunityShort {
  id: number;
  name: string;
  title: string;
}
interface ICommunity extends ICommunityShort {
  about: string;
  admins: string[];
  avatar_url: string;
  creation_date: Date;
  subscribers_count: number;
  authors_count: number;
  pending_count: number;
}

interface IAuthorShort {
  id: number;
  name: string;
  avatar: string;
    url: string;
}

interface IBlogUser extends IAuthorShort {
  creation_date: Date;
  comment_count: number;
  post_count: number;
  registered_date: Date;
  last_activity: Date;
  description: string;
}

interface IComment {
  id: string;
  author: IAuthorShort;
  content: string;
  published_at: Date;
  updated_at: Date;
  url: string;
  enumVotes: (filter: unknown, page: number) => Iterable<IVote>;
}

interface ISession {

}


interface IPostProperties {
  id: string;
  title: string;
  slug: string;
  author: IAuthorShort;
  summary: string;
  tags: string[];
  community: ICommunityShort;
  published_at: Date;
  updated_at: Date;
  url: string;
}

interface IPost extends IPostProperties {
  content: string;
  enumComments: (filter: unknown, page: number) => Iterable<IComment>;
  enumMentionedAccounts: () => Iterable<IAuthorShort>;
  getTitleImage: () => string;
  enumVotes: (filter: unknown, page: number) => Iterable<IVote>;
}

interface IActiveBloggingPlatform {
  post: (post_data: IPost) => void;
  comment: (post: string, comment_data: IComment) => void;
  vote: (post: string, vote_data: IVote ) => void;
  reblog: (post: string) => void;
}

interface BloggingPlatform {
  enumPosts: (filter: unknown, page: number) => Iterable<IPost>;
  configureAccountContext: (accont_name: string) => void;
  authorize(provider: unknown);
}
