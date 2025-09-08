import { IAccount, IComment, IPagination, IPostCommentIdentity, IPostCommentsFilters, IReply } from "./interfaces";


export class Reply implements IReply {



  public readonly author: { name: string };
  public readonly permlink: string;
  public readonly publishedAt: Date;
  public readonly updatedAt: Date;

  public constructor(authorPermlink: IPostCommentIdentity) {
    this.author = authorPermlink.author;
    this.permlink = authorPermlink.permlink;
    this.publishedAt = new Date();
    this.updatedAt = new Date();
  }

  


}
