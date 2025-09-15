import { Comment } from "./Comment";
import { IBloggingPlatform, ICommunityIdentity, IPagination, IPost, IPostCommentIdentity, IPostCommentsFilters, IReply } from "./interfaces";
import { Reply } from "./Reply";
import { paginateData } from "./utils";
import { Entry } from "./wax";

export class Post extends Comment implements IPost  {

  public title: string;
  public tags: string[];
  public community?: ICommunityIdentity;
  public summary: string;
  public communityTitle?: string;

  private replies?: IReply[];

  public constructor(authorPermlink: IPostCommentIdentity, bloggingPlatform: IBloggingPlatform, postData: Entry) {
    super(authorPermlink, bloggingPlatform, postData);
    this.title = postData.title;
    this.tags = postData.json_metadata?.tags || [];
    this.summary = postData.json_metadata?.description || "";
    this.community = postData.community ? {name: postData.community} : undefined;
    this.communityTitle = postData.community_title
  }

  private async fetchReplies(): Promise<IReply[]> {
    if (!this.replies) {
      const repliesData = await this.chain.api.bridge.get_discussion({
        author: this.author,
        permlink: this.permlink,
        observer: this.BloggingPlatform.viewerContext.name,
      }); // Temporary hive.blog;
      if (!repliesData)
        throw "No replies";
      const filteredReplies = Object.values(repliesData).filter((rawReply) => !!rawReply.parent_author)
      const replies = filteredReplies?.map(
        (reply) =>
          new Reply(
            { author: reply.author, permlink: reply.permlink },
            this.BloggingPlatform,
            {
              author: reply.parent_author || "",
              permlink: reply.parent_permlink || "",
            },
            { author: this.author, permlink: this.permlink },
            reply
          )
      )
      this.replies = replies;
      return replies;
    }
    return this.replies;
  }

  public async getContent(): Promise<string> {
    if (this.content)
      return this.content;
    await this.chain.api.bridge.get_post({author: this.author, permlink: this.permlink, observer: this.BloggingPlatform.viewerContext.name});
    return this.content || "";
  }

  public getTitleImage(): string {
    // The logic is complicated here, it wil be added later.
    return "";
  }

  public async enumReplies(filter: IPostCommentsFilters, pagination: IPagination): Promise<Iterable<IReply>> {
    if (this.replies) return paginateData(this.replies, pagination);
    return paginateData(await this.fetchReplies(), pagination);
  }

  public async getCommentsCount(): Promise<number> {
    if (this.replies) return this.replies.length;

    return (await this.fetchReplies()).length;
  }

}
