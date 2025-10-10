import { Comment } from "./Comment";
import { DataProvider } from "./DataProvider";
import { ICommonFilters, ICommunityIdentity, IPagination, IPost, IPostCommentIdentity, IReply } from "./interfaces";
import { Reply } from "./Reply";

export class Post extends Comment implements IPost  {

  public title: string;
  public tags: string[];
  public community?: ICommunityIdentity;
  public summary: string;
  public communityTitle?: string;

  private postImage?: string;

  public constructor(authorPermlink: IPostCommentIdentity, dataProvider: DataProvider) {
    super(authorPermlink, dataProvider);
    const post = dataProvider.getComment(authorPermlink);
    this.title = post?.title || "";
    this.tags = post?.json_metadata?.tags || [];
    this.summary = post?.json_metadata?.description || "";
    this.community = post?.community ? {name: post.community} : undefined;
    this.communityTitle = post?.community_title
    this.postImage = post?.json_metadata.image?.[0];

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
  public async enumReplies(filter: ICommonFilters, pagination: IPagination): Promise<Iterable<IReply>> {
    const postId = {author: this.author, permlink: this.permlink};
    const repliesIds = await this.dataProvider.enumReplies(postId, filter, pagination) || [];
    return repliesIds.map((replyId) => new Reply(replyId, this.dataProvider, postId));
  }

  /**
   * Get number of comments (replies) for given post.
   */
  public async getCommentsCount(): Promise<number> {
    const postId = {author: this.author, permlink: this.permlink};
    let repliesIds = this.dataProvider.getRepliesIdsByPost(postId);
    if (!repliesIds)
      repliesIds = await this.dataProvider.enumReplies(postId, {}, {page: 1, pageSize: 10000});
    return repliesIds.length;
  }

}
