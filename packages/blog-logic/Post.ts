import { TWaxExtended } from "@hiveio/wax";
import { IAccount, IAccountIdentity, ICommunityIdentity, IPagination, IPost, IPostCommentIdentity, IPostCommentsFilters, IReply, IVote } from "./interfaces";
import { Entry, ExtendedNodeApi, getWax } from "./wax";
import { Comment } from "./Comment";
import { Reply } from "./Reply";

export class Post extends Comment implements IPost  {

  public author: IAccountIdentity;
  public permlink: string;
  public publishedAt: Date;
  public updatedAt: Date;
  public title: string;
  public tags: string[];
  public community?: ICommunityIdentity | undefined;
  public summary: string;

  public constructor(authorPermlink: IPostCommentIdentity, postData?: Entry) {
    super(authorPermlink, postData);
    if (postData) {
      this.title = postData.title;
      this.tags = postData.json_metadata?.tags || [];
      this.summary = postData.json_metadata?.description || "";
      this.community = postData.community ? {name: postData.community} : undefined;
    }
  }

  public async getContent(): Promise<string> {
    if (this.content)
      return this.content;
    await this.chain.api.bridge.get_post({author: this.author.name, permlink: this.permlink, observer: "hive.blog"});
    return this.content || "";
  }

  public getTitleImage(): string {
    return "";
  }

  public async enumReplies(filter: IPostCommentsFilters, pagination: IPagination): Promise<Iterable<IReply>> {
    const replies = await this.chain.api.bridge.get_discussion({author: this.author.name, permlink: this.permlink, observer: "hive.blog"}) // Temporary hive.blog;
    if (!replies) {
      throw "No replies";
    }
    return Object.entries(replies)?.map(([authorPermlink, reply]) => new Reply(
      {author: {name: reply.author}, permlink: reply.permlink},
      {author: {name: reply.parent_author || ""}, permlink: reply.parent_permlink || ""},
      {author: this.author, permlink: this.permlink},
      reply
    ))
  }

}