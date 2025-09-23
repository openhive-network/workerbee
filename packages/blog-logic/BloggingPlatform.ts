import { TWaxExtended } from "@hiveio/wax";
import { IAccountIdentity,
  IBloggingPlatform,
  ICommunity,
  ICommunityFilters,
  IPagination,
  IPost,
  IPostCommentIdentity,
  IPostCommentsFilters
} from "./interfaces";
import { Post } from "./Post";
import { paginateData } from "./utils";
import { ExtendedNodeApi, getWax } from "./wax";

export class BloggingPlaform implements IBloggingPlatform {
  public viewerContext: IAccountIdentity;

  private chain?: TWaxExtended<ExtendedNodeApi>

  private initializeChain = async () => {
    if (!this.chain)
      this.chain = await getWax();
  }


  public constructor() {
    this.viewerContext = {name: "hive.blog"}; // Set default
    this.initializeChain();
  }

  public configureViewContext(accontName: IAccountIdentity): void {
    this.viewerContext = accontName;
  }


  public async getPost(postId: IPostCommentIdentity): Promise<IPost> {
    if (!this.chain)
      await this.initializeChain();
    const postData = await this.chain?.api.bridge.get_post({author: postId.author, permlink: postId.permlink, observer: this.viewerContext.name });
    if (!postData)
      throw new Error("Post not found");
    return new Post(postId, this, postData!);
  }

  public async enumCommunities(filter: ICommunityFilters, pagination: IPagination): Promise<Iterable<ICommunity>> {
    return await [];
  }

  public async enumPosts(filter: IPostCommentsFilters, pagination: IPagination): Promise<Iterable<IPost>> {
    if (!this.chain)
      await this.initializeChain();
    const posts = await this.chain?.api.bridge.get_ranked_posts({
      limit: filter.limit,
      sort: filter.sort,
      observer: this.viewerContext.name,
      start_author: filter.startAuthor,
      start_permlink: filter.startPermlink,
      tag: filter.tag
    });
    if (!posts)
      throw new Error("Posts not found");
    const paginatedPosts = paginateData(posts, pagination);
    return paginatedPosts?.map((post) => new Post({author: post.author, permlink: post.permlink}, this, post))
  }
}
