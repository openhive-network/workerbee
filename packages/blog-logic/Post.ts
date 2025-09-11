import { TWaxExtended } from "@hiveio/wax";
import { IAccount, IAccountIdentity, ICommunityIdentity, IPagination, IPost, IPostCommentIdentity, IPostCommentsFilters, IReply, IVote } from "./interfaces";
import { Entry, ExtendedNodeApi, getWax } from "./wax";
import { Comment } from "./Comment";

export class Post extends Comment implements IPost  {

  public author: IAccountIdentity;
  public permlink: string;
  public publishedAt: Date;
  public updatedAt: Date;
  public title: string;
  public tags: string[];
  public community?: ICommunityIdentity | undefined;
  public summary: string;

  public constructor(authorPermlink: IPostCommentIdentity, postData: Entry) {
    super(authorPermlink, postData);

    this.title = postData.title;
    this.tags = postData.json_metadata?.tags || [];
    this.summary = postData.json_metadata?.description || "";
    this.community = postData.community ? {name: postData.community} : undefined;
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

}