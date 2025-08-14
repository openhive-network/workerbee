import { IBloggingPlatform, IPost, IPostCommentIdentity } from "./interfaces"
import { WPGetPostsParams, WPPost } from "./wordpress-reference"

/*
We need to get this done in 4 categories:
1. Users
2. Sites
3. Posts
4. Comments
*/

/*
  Problem 1 - posts in WordPress have ID as number, when ID of Hive posts is accout/permlink.
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
      
    }
  }

  getPosts(params: WPGetPostsParams): Iterable<IPost> {
    return [];
  }

}