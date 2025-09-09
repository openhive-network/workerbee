import { TWaxExtended } from "@hiveio/wax";
import { IAccount, IAccountIdentity, ICommunityIdentity, IPagination, IPost, IPostCommentIdentity, IPostCommentsFilters, IReply, IVote } from "./interfaces";
import { ExtendedNodeApi, getWax } from "./wax";

export class Post implements IPost {

  private chain: TWaxExtended<ExtendedNodeApi>

  public author: IAccountIdentity;
  public permlink: string;
  public publishedAt: Date;
  public updatedAt: Date;
  public title: string;
  public tags: string[];
  public community?: ICommunityIdentity | undefined;
  public summary: string;

  private content?: string;

  private initializeChain = async () => {
    if (!this.chain)
      this.chain = await getWax();
  }

  private getPostData = async () => {
    await this.initializeChain();
    const postData = await this.chain.api.bridge.get_post({author: this.author.name, permlink: this.permlink, observer: "hive.blog"});
    this.author = {name: postData?.author || ""};
    this.permlink = postData?.permlink || "";
    this.publishedAt = new Date(postData?.created || "");
    this.updatedAt = new Date(postData?.updated || "");
    this.title = postData?.title || "";
    this.content = postData?.body || "";
    this.summary = this.content.substring(0, 140);
    this.tags = postData?.json_metadata.tags || [];
  }

  public constructor(authorPermlink: IPostCommentIdentity) {
    this.initializeChain();
    this.author = authorPermlink.author;
    this.permlink = authorPermlink.permlink;
  }

  public generateSlug(): string {
    return `${this.author.name}_${this.permlink}`;
  }

  public enumReplies(filter: IPostCommentsFilters, pagination: IPagination): Iterable<IReply> {
    return [];
  }

  public enumMentionedAccounts(): Iterable<IAccountIdentity> {
    return [];
  }

  public async getContent(): Promise<string> {
    if (this.content)
      return this.content;
    await this.getPostData();
    await this.chain.api.bridge.get_post({author: this.author.name, permlink: this.permlink, observer: "hive.blog"});
    return this.content || "";
  }

  public enumVotes(filter: IPostCommentsFilters, pagination: IPagination): Iterable<IVote> {
    return [];
  }

  public getCommentsCount(): number {
    return 0;
  }

  public wasVotedByUser(userName: IAccountIdentity): boolean {
    return false;
  }

  public getTitleImage(): string {
    return "";
  }

}