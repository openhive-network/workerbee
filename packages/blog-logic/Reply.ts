import { IAccount, IComment, IPagination, IPostCommentIdentity, IPostCommentsFilters, IReply } from "./interfaces";
import { Entry } from "./wax";


export class Reply implements IReply {



  public readonly author: { name: string };
  public readonly permlink: string;
  public readonly publishedAt: Date;
  public readonly updatedAt: Date;
  public parent: IPostCommentIdentity;
  public topPost: IPostCommentIdentity;


  public constructor(authorPermlink: IPostCommentIdentity, parent: IPostCommentIdentity, topPost: IPostCommentIdentity,  replyData: Entry) {
    this.author = authorPermlink.author;
    this.permlink = authorPermlink.permlink;
    this.publishedAt = new Date(replyData.created);
    this.updatedAt = new Date(replyData.updated);
  }


  public enumReplies(filter: IPostCommentsFilters, pagination: IPagination): Promise<Iterable<IReply>>;
  enumMentionedAccounts(): Promise<Iterable<IAccountIdentity>>;
  enumVotes(filter: IPostCommentsFilters, pagination: IPagination): Promise<Iterable<IVote>>;
  getContent(): Promise<string>;
  wasVotedByUser(userName: IAccountIdentity): Promise<boolean>;
  getCommentsCount(): Promise<number>;

}
