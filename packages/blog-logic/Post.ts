import { Comment } from "./Comment";
import { ICommunityIdentity, IPagination, IPost, IPostCommentIdentity, IPostCommentsFilters, IReply } from "./interfaces";
import { Reply } from "./Reply";
import { Entry } from "./wax";

export class Post extends Comment implements IPost  {

  public title: string;
  public tags: string[];
  public community?: ICommunityIdentity | undefined;
  public summary: string;

  private replies?: IReply[];

  public constructor(authorPermlink: IPostCommentIdentity, postData?: Entry) {
    super(authorPermlink, postData);
    if (postData) {
      this.title = postData.title;
      this.tags = postData.json_metadata?.tags || [];
      this.summary = postData.json_metadata?.description || "";
      this.community = postData.community ? {name: postData.community} : undefined;
    }
  }

  private async fetchReplies(): Promise<IReply[]> {
    if (!this.replies) {
      const repliesData = await this.chain.api.bridge.get_discussion({
        author: this.author.name,
        permlink: this.permlink,
        observer: "hive.blog",
      }); // Temporary hive.blog;
      if (!repliesData)
        throw "No replies";
      const replies = Object.entries(repliesData)?.map(
        ([authorPermlink, reply]) =>
          new Reply(
            { author: { name: reply.author }, permlink: reply.permlink },
            {
              author: { name: reply.parent_author || "" },
              permlink: reply.parent_permlink || "",
            },
            { author: this.author, permlink: this.permlink },
            reply
          )
      );
      this.replies = replies;
      return replies;
    }
    return this.replies;
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
    if (this.replies) return this.replies;
    return await this.fetchReplies();
  }

  public async getCommentsCount(): Promise<number> {
    if (this.replies) return this.replies.length;

    return (await this.fetchReplies()).length;
  }

}