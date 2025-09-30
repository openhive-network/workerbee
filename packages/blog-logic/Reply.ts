import { Comment } from "./Comment";
import { DataProvider } from "./DataProvider";
import { IPostCommentIdentity, IReply } from "./interfaces";

export class Reply extends Comment implements IReply {
  public parent: IPostCommentIdentity;
  public topPost: IPostCommentIdentity;

  public constructor(
    authorPermlink: IPostCommentIdentity,
    dataProvider: DataProvider,
    parent: IPostCommentIdentity,
    topPost: IPostCommentIdentity
  ) {
    super(authorPermlink, dataProvider);
    this.parent = parent;
    this.topPost = topPost;
  }
}
