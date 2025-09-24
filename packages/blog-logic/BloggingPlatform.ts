import { TWaxExtended } from "@hiveio/wax";
import { Account } from "./Account";
import { Community } from "./Community";
import { IAccount, IAccountIdentity,
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

  private chain?: TWaxExtended<ExtendedNodeApi>;


  private initializeChain = async () => {
    if (!this.chain)
      this.chain = await getWax();
  }
  // Add initilaize chain to constructor


  public overwrittenGetTitleImage?: () => string;

  public constructor() {
    this.viewerContext = {name: "hive.blog"}; // Set default
    this.initializeChain();
  }

  /**
   * Change the observer for blog.
   * @param accontName account name or community.
   */
  public configureViewContext(accontName: IAccountIdentity): void {
    this.viewerContext = accontName;
  }


  /**
   * Get single post idetified by author/permlink.
   * @param postId
   * @returns post object
   */
  public async getPost(postId: IPostCommentIdentity): Promise<IPost> {
    await this.initializeChain();
    const postData = await this.chain?.api.bridge.get_post({author: postId.author, permlink: postId.permlink, observer: this.viewerContext.name });
    if (!postData)
      throw new Error("Post not found");
    return new Post(postId, this, postData!);
  }

  /**
   * Enumarate all communities for given filters
   * @param filter
   * @param pagination
   * @returns iterable of community objects
   */
  public async enumCommunities(filter: ICommunityFilters, pagination: IPagination): Promise<Iterable<ICommunity>> {
    await this.initializeChain();
    const communities = await this.chain?.api.bridge.list_communities({observer: this.viewerContext.name, sort: filter.sort, query: filter.query});
    if (communities) return paginateData(communities.map((community) => new Community(community)), pagination);
    return await [];
  }

  /**
   * Get posts for selected filters.
   * @param filter
   * @param pagination
   * @returns iterable of posts
   */
  public async enumPosts(filter: IPostCommentsFilters, pagination: IPagination): Promise<Iterable<IPost>> {
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

  /**
   * Get account object for given account name.
   * @param accontName
   * @returns account object
   */
  public async getAccount(accontName: string): Promise<IAccount> {
    await this.initializeChain();
    const account = await this.chain?.api.condenser_api.get_accounts([[accontName]]);
    if (!account)
      throw new Error("Account not found");
    return new Account(account[0]);
  }

  // Section for overwritting methods

  /**
   * It allows other project to overwrite title image method with their custom implementation.
   * @param callbackMethod custom method for getting title image.
   */
  public overwriteGetTitleImage(callbackMethod: () => string) {
    this.overwriteGetTitleImage = callbackMethod;
  }
}
