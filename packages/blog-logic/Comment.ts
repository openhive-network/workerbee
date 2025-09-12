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
  protected votes?: Iterable<IVote>;

  private initializeChain = async () => {
    if (!this.chain)
      this.chain = await getWax();
    
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

  public async wasVotedByUser(userName: IAccountIdentity): Promise<boolean> {
    return false;
  }

}