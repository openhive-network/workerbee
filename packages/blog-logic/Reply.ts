import { Comment } from "./Comment";
import {  IPostCommentIdentity, IReply } from "./interfaces";
import { Entry } from "./wax";


export class Reply extends Comment implements IReply {

  public parent: IPostCommentIdentity;
  public topPost: IPostCommentIdentity;


  public constructor(authorPermlink: IPostCommentIdentity, parent: IPostCommentIdentity, topPost: IPostCommentIdentity,  replyData: Entry) {
    super(authorPermlink, replyData);
    this.parent = parent;
    this.topPost = topPost;
  }


}
