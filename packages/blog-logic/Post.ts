import { Comment } from "./Comment";
import { DataProvider } from "./DataProvider";
import { ICommunityIdentity, IPagination, IPost, IPostCommentIdentity, IPostCommentsFilters, IReply } from "./interfaces";
import { Reply } from "./Reply";
import { paginateData } from "./utils";

export class Post extends Comment implements IPost  {

  public title: string;
  public tags: string[];
  public community?: ICommunityIdentity;
  public summary: string;
  public communityTitle?: string;

  private replies?: Iterable<IReply>;
  private postImage?: string;

  public constructor(authorPermlink: IPostCommentIdentity, dataProvider: DataProvider) {
    super(authorPermlink, dataProvider);
    const post = dataProvider.getPost(authorPermlink);
    this.title = post?.title || "";
    this.tags = post?.json_metadata?.tags || [];
    this.summary = post?.json_metadata?.description || "";
    this.community = post?.community ? {name: post.community} : undefined;
    this.communityTitle = post?.community_title
    this.postImage = post?.json_metadata.image?.[0];
  }

  /**
   * Fetch and return all replies for post. Do pagination later.
   * @returns iterable of replies
   */
  private async fetchReplies(): Promise<Iterable<IReply>> {
    if (!this.replies) {
      const repliesData = await this.dataProvider.chain.api.bridge.get_discussion({
        author: this.author,
        permlink: this.permlink,
        observer: this.dataProvider.bloggingPlatform.viewerContext.name,
      });
      if (!repliesData)
        throw "No replies";
      const filteredReplies = Object.values(repliesData).filter((rawReply) => !!rawReply.parent_author)
      const replies = filteredReplies?.map(
        (reply) =>
          new Reply(
            { author: reply.author, permlink: reply.permlink },
            this.dataProvider,
            {
              author: reply.parent_author || "",
              permlink: reply.parent_permlink || "",
            },
            { author: this.author, permlink: this.permlink }
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
    if (this.dataProvider.bloggingPlatform.overwrittenGetTitleImage) return this.dataProvider.bloggingPlatform.overwrittenGetTitleImage()
    return this.postImage || ""
  }

  /**
   * Enum replies for given post.
   * @param filter
   * @param pagination
   * @returns iterable of replies objects
   */
  public async enumReplies(filter: IPostCommentsFilters, pagination: IPagination): Promise<Iterable<IReply>> {
    if (this.replies) return paginateData(Array.from(this.replies), pagination);
    return paginateData(await this.fetchReplies() as IReply[], pagination);
  }

  /**
   * Get number of comments (replies) for given post.
   */
  public async getCommentsCount(): Promise<number> {
    if (this.replies) return Array.from(this.replies).length;

    return (Array.from(await this.fetchReplies())).length;
  }

}
