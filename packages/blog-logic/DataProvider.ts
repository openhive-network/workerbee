import { TWaxExtended, TWaxRestExtended } from "@hiveio/wax";
import { BloggingPlaform } from "./BloggingPlatform";
import { IPostCommentIdentity, IPostCommentsFilters } from "./interfaces";
import { ExtendedNodeApi, ExtendedRestApi, Entry } from "./wax";

export class DataProvider {
  private posts: Map<string, Entry> = new Map();

  public chain: TWaxExtended<ExtendedNodeApi, TWaxRestExtended<ExtendedRestApi>>;
  public bloggingPlatform: BloggingPlaform;

  public constructor(chain: TWaxExtended<ExtendedNodeApi, TWaxRestExtended<ExtendedRestApi>>) {
    this.chain = chain;
    this.bloggingPlatform = new BloggingPlaform(this);
  }

  private convertCommentIdToHash(commentId: IPostCommentIdentity): string {
    return `${commentId.author}_${commentId.permlink}`
  }

  public getPost(postId: IPostCommentIdentity): Entry | null {
    return this.posts.get(this.convertCommentIdToHash(postId)) || null;
  }

  public async fetchPost(postId: IPostCommentIdentity): Promise<void> {
    const fetchedPostData = await this.chain.api.bridge.get_post({
      author: postId.author,
      permlink: postId.permlink,
      observer: this.bloggingPlatform.viewerContext.name,
    });
    if (!fetchedPostData)
      throw new Error("Post not found");
    this.posts.set(this.convertCommentIdToHash(postId), fetchedPostData);
  }

  public async enumPosts(filter: IPostCommentsFilters): Promise<Iterable<IPostCommentIdentity>> {
    const posts = await this.chain.api.bridge.get_ranked_posts({
      limit: filter.limit,
      sort: filter.sort,
      observer: this.bloggingPlatform.viewerContext.name,
      start_author: filter.startAuthor,
      start_permlink: filter.startPermlink,
      tag: filter.tag
    });
    if (!posts)
      throw new Error("Posts not found");
    posts.forEach((post) => {
      const postId = {author: post.author, permlink: post.permlink}
      this.posts.set(this.convertCommentIdToHash(postId), post);
    })
    return posts.map((post) => ({author: post.author, permlink: post.permlink}));
  }

}
