import { Comment } from "./Comment";
import { IAccount, IComment, IPagination, IPostCommentIdentity, IPostCommentsFilters, IReply } from "./interfaces";
import { Entry } from "./wax";


export class Reply extends Comment implements IReply {



  public readonly author: { name: string };
  public readonly permlink: string;
  public readonly publishedAt: Date;
  public readonly updatedAt: Date;
  public parent: IPostCommentIdentity;
  public topPost: IPostCommentIdentity;


  public constructor(authorPermlink: IPostCommentIdentity, parent: IPostCommentIdentity, topPost: IPostCommentIdentity,  replyData: Entry) {
    super(authorPermlink, replyData);
    this.parent = parent;
    this.topPost = topPost;
  }
  

}
