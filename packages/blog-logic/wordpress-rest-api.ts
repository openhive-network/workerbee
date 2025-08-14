import { IBloggingPlatform, IPost, IPostCommentIdentity, IPostCommentsFilters } from "./interfaces"
import { WPGetPostsParams, WPPost } from "./wordpress-reference"

/*
We need to get this done in 4 categories:
1. Users
2. Sites
3. Posts
4. Comments
*/

/*
  Problem 1 - posts in WordPress have ID as number, when ID of Hive posts is accout/permlink. Everything is identified by
*/

class RestAPI {
  private bloggingPlatform: IBloggingPlatform;

  private extractFullIdFromPostId (postId: string): IPostCommentIdentity {
    const splitedPostId = postId.split("/");
    return {
      author: {
        name: splitedPostId[0],
      },
      id: splitedPostId[1]
    }
  }

  getPostById(postId: string): WPPost {
    const post = this.bloggingPlatform.getPost(this.extractFullIdFromPostId(postId))
    return {
      id: 0, // TEMP
      author: 0, // TEMP
      categories: [],// TEMP we need to transpone tags for this
      comment_status: 'open', // By default always open
      content: {
        protected: false,
        rendered: post.getContent()
      },
      date: post.publishedAt,
      date_gmt: post.publishedAt,
      excerpt: {
        protected: false,
        rendered: post.summary
      },
      featured_media: 0, // TEMP, no idea
      format: "standard",
      guid: {
        rendered:post.generateSlug(),
      }, // Not sure yet
      link: post.generateSlug(),
      meta: {}, // Nothing so far
      modified: post.updatedAt,
      modified_gmt: post.updatedAt,
      ping_status: "closed",
      slug: post.generateSlug(),
      status: "publish",
      sticky: false,
      tags: [], // convert them later to our text tags
      template: "", // No idea so far,
      title: {
        rendered: post.title
      },
      type: "" // uknown

    }
  }

  getPosts(params: WPGetPostsParams): Iterable<IPost> {
    const filters: IPostCommentsFilters = {
      endTime: params.before ? params.before : undefined,
      startTime: params.after ? params.after : undefined,
      sortBy: params.orderby ? params.orderby: undefined, // Adjust possible sorts
    }
    const posts = this.bloggingPlatform.enumPosts(filters, {page: params.page || 1, pageSize: params.per_page || 100})
    return posts;
  }

}