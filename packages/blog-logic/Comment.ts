import { TWaxExtended } from "@hiveio/wax";
import { IAccountIdentity, IBloggingPlatform, IComment, IPagination, IPostCommentIdentity, IPostCommentsFilters, IVote } from "./interfaces";
import { Entry, ExtendedNodeApi, getWax } from "./wax";

export class Comment implements IComment {

  protected chain: TWaxExtended<ExtendedNodeApi>

  public author: string;
  public permlink: string;
  public publishedAt: Date;
  public updatedAt: Date;


  protected content?: string;
  protected votes?: Iterable<IVote>;
  protected BloggingPlatform: IBloggingPlatform;

  private initializeChain = async () => {
    if (!this.chain)
      this.chain = await getWax();
  }

  public constructor(authorPermlink: IPostCommentIdentity, bloggingPlatform: IBloggingPlatform, postCommentData?: Entry, ) {
    this.initializeChain();
    this.author = authorPermlink.author;
    this.permlink = authorPermlink.permlink;
    this.BloggingPlatform = bloggingPlatform

    if(postCommentData) {
      this.publishedAt = new Date(postCommentData.created);
      this.updatedAt = new Date(postCommentData.updated);
      this.content = postCommentData.body;
    }
  }

  public generateSlug(): string {
    return `${this.author}_${this.permlink}`;
  }

  public async enumMentionedAccounts(): Promise<Iterable<IAccountIdentity>> {
    return await [];
  }

  public async getContent(): Promise<string> {
    if (this.content)
      return this.content;
    await this.chain.api.bridge.get_post({author: this.author, permlink: this.permlink, observer: "hive.blog"});
    return this.content || "";
  }

  public async enumVotes(filter: IPostCommentsFilters, pagination: IPagination): Promise<Iterable<IVote>> {
    return await [];
  }

  public async wasVotedByUser(userName: IAccountIdentity): Promise<boolean> {
    return await false;
  }

}