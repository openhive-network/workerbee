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

  private replies?: Iterable<IReply>;
  private postImage?: string;

  public constructor(authorPermlink: IPostCommentIdentity, bloggingPlatform: IBloggingPlatform, postData: Entry) {
    super(authorPermlink, bloggingPlatform, postData);
    this.title = postData.title;
    this.tags = postData.json_metadata?.tags || [];
    this.summary = postData.json_metadata?.description || "";
    this.community = postData.community ? {name: postData.community} : undefined;
    this.communityTitle = postData.community_title
    this.postImage = postData.json_metadata.image?.[0];
  }

  /**
   * Fetch and return all replies for post. Do pagination later.
   * @returns iterable of replies
   */
  private async fetchReplies(): Promise<Iterable<IReply>> {
    this.initializeChain();
    if (!this.replies) {
      const repliesData = await this.chain!.api.bridge.get_discussion({
        author: this.author,
        permlink: this.permlink,
        observer: this.bloggingPlatform.viewerContext.name,
      });
      if (!repliesData)
        throw "No replies";
      const filteredReplies = Object.values(repliesData).filter((rawReply) => !!rawReply.parent_author)
      const replies = filteredReplies?.map(
        (reply) =>
          new Reply(
            { author: reply.author, permlink: reply.permlink },
            this.bloggingPlatform,
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

  /**
   * Get title image from post content.
   * @returns Link to title image
   */
  public getTitleImage(): string {
    if (this.bloggingPlatform.overwrittenGetTitleImage) return this.bloggingPlatform.overwrittenGetTitleImage()
    return this.postImage || ""
  }

  /**
   * Enum replies for given post.
   * @param filter
   * @param pagination
   * @returns iterable of replies objects
   */
  public async enumReplies(filter: IPostCommentsFilters, pagination: IPagination): Promise<Iterable<IReply>> {
    this.initializeChain();
    if (this.replies) return paginateData(Array.from(this.replies), pagination);
    return paginateData(await this.fetchReplies() as IReply[], pagination);
  }

  /**
   * Get number of comments (replies) for given post.
   */
  public async getCommentsCount(): Promise<number> {
    this.initializeChain();
    if (this.replies) return Array.from(this.replies).length;

    return (Array.from(await this.fetchReplies())).length;
  }

}
