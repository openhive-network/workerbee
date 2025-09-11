import { TWaxExtended } from "@hiveio/wax";
import { IAccount, IAccountIdentity, IComment, ICommunityIdentity, IPagination, IPost, IPostCommentIdentity, IPostCommentsFilters, IReply, IVote } from "./interfaces";
import { Entry, ExtendedNodeApi, getWax } from "./wax";
import { Reply } from "./Reply";

export class Comment implements IComment {

  protected chain: TWaxExtended<ExtendedNodeApi>

  public author: IAccountIdentity;
  public permlink: string;
  public publishedAt: Date;
  public updatedAt: Date;


  protected content?: string;

  private initializeChain = async () => {
    if (!this.chain)
      this.chain = await getWax();
    
  }

  private getData = async () => {
    const commentData = await this.chain.api.bridge.get_post({author: this.author.name, permlink: this.permlink, observer: "hive.blog"}); // Teemporary hive.blog
    this.publishedAt = new Date(commentData?.created || "");
    this.updatedAt = new Date(commentData?.updated || "");
    this.content = commentData?.body;
  }

  public constructor(authorPermlink: IPostCommentIdentity, postCommentData?: Entry) {
    this.initializeChain();
    this.author = authorPermlink.author;
    this.permlink = authorPermlink.permlink;

    if(postCommentData) {
      this.publishedAt = new Date(postCommentData.created);
      this.updatedAt = new Date(postCommentData.updated);
      this.content = postCommentData.body;
    }
  }

  public generateSlug(): string {
    return `${this.author.name}_${this.permlink}`;
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

  public async enumMentionedAccounts(): Promise<Iterable<IAccountIdentity>> {
    return [];
  }

  public async getContent(): Promise<string> {
    if (this.content)
      return this.content;
    await this.chain.api.bridge.get_post({author: this.author.name, permlink: this.permlink, observer: "hive.blog"});
    return this.content || "";
  }

  public async enumVotes(filter: IPostCommentsFilters, pagination: IPagination): Promise<Iterable<IVote>> {
    return [];
  }

  public async getCommentsCount(): Promise<number> {
    return 0;
  }

  public async wasVotedByUser(userName: IAccountIdentity): Promise<boolean> {
    return false;
  }

}