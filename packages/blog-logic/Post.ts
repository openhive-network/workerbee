import { TWaxExtended } from "@hiveio/wax";
import { IAccount, IAccountIdentity, ICommunityIdentity, IPagination, IPost, IPostCommentIdentity, IPostCommentsFilters, IReply, IVote } from "./interfaces";
import { Entry, ExtendedNodeApi, getWax } from "./wax";

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

  public constructor(authorPermlink: IPostCommentIdentity, postData: Entry) {
    this.initializeChain();
    this.author = authorPermlink.author;
    this.permlink = authorPermlink.permlink;

    this.publishedAt = new Date(postData.created);
    this.updatedAt = new Date(postData.updated);
    this.title = postData.title;
    this.tags = postData.json_metadata?.tags || [];
    this.summary = postData.json_metadata?.description || "";
    this.community = postData.community ? {name: postData.community} : undefined;
    this.content = postData.body;
  }

  public generateSlug(): string {
    return `${this.author.name}_${this.permlink}`;
  }

  public enumReplies(filter: IPostCommentsFilters, pagination: IPagination): Promise<Iterable<IReply>> {
    return [];
  }

  public enumMentionedAccounts(): Promise<Iterable<IAccountIdentity>> {
    return [];
  }

  public async getContent(): Promise<string> {
    if (this.content)
      return this.content;
    await this.getPostData();
    await this.chain.api.bridge.get_post({author: this.author.name, permlink: this.permlink, observer: "hive.blog"});
    return this.content || "";
  }

  public enumVotes(filter: IPostCommentsFilters, pagination: IPagination): Promise<Iterable<IVote>> {
    return [];
  }

  public getCommentsCount(): Promise<number> {
    return 0;
  }

  public wasVotedByUser(userName: IAccountIdentity): Promise<boolean> {
    return false;
  }

  public getTitleImage(): string {
    return "";
  }

}