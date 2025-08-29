import { IActiveBloggingPlatform, IBloggingPlatform, IComment, IPost, IPostCommentIdentity, IPostCommentsFilters } from "./interfaces"
import { WPComment, WPCreatePostPayload, WPGetCommentsParams, WPGetPostsParams, WPPost, WPUser } from "./wordpress-reference"
import type { Request, Response } from "express";
import express from "express";

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



export class RestAPI {

  constructor (initialBloggingPlatform) {
    this.bloggingPlatform = initialBloggingPlatform;
  }
  private bloggingPlatform: IBloggingPlatform;

  public createServer () {
    const app = express();

    app.get("/posts", (req: Request, res: Response) => {
      const query = req.query;
      res.json(this.getPosts(query))
    }) 

    app.get("/comments", (req: Request, res: Response) => {
      const query = req.query;
      res.json(this.getComments(query))
    }) 

    app.get("/categories", (req: Request, res: Response) => {
      const query = req.query;
      //res.json()
    }) 

    app.get("/tags", (req: Request, res: Response) => {
      const query = req.query;
      //res.json()
    }) 

    app.get("/users", (req: Request, res: Response) => {
      const query = req.query;
      //res.json()
    }) 

    app.get("/media", (req: Request, res: Response) => {
      const query = req.query;
      res.json([])
    }) 

    app.get("/pages", (req: Request, res: Response) => {
      const query = req.query;
      res.json([])
    }) 
  }

  private getHivePostCommentIdentificationByWPId (wpInteger: number): IPostCommentIdentity {
    // Insert all hask code there
    return {author: {name: ""}, permlink: ""};
  }

  private hashStringToInteger (name: string): number {
    // Return the converted value.
    return 0;
  }


  private translateIPostToWPPost(post: IPost): WPPost {
    return {
      id: this.hashStringToInteger(post.permlink), // TEMP
      author: this.hashStringToInteger(post.author.name), // TEMP
      categories: [], // No idea what to do with this if tags are a thing
      comment_status: "open", // By default always open
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
      featured_media: 0, // It can be set to 0
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
      tags: post.tags.map((tag) => this.hashStringToInteger(tag)), // convert them later to our text tags
      template: "", // No idea so far,
      title: {
        rendered: post.title
      },
      type: "post" // uknown

    }
  }

  public getPostById(postId: number): WPPost {
    const post = this.bloggingPlatform.getPost(this.getHivePostCommentIdentificationByWPId(postId))
    return this.translateIPostToWPPost(post);
  }

  public * getPosts(params: WPGetPostsParams): Iterable<WPPost> {
    const filters: IPostCommentsFilters = {
      endTime: params.before,
      startTime: params.after,
      sortBy: params.orderby,
      modificationStartTime: params.modified_before,
      modificationEndTime: params.modified_before,
      order: params.order,
      slug: params.slug,
      searchInText: params.search,

    }
    const posts = this.bloggingPlatform.enumPosts(filters, {page: params.page || 1, pageSize: params.per_page || 100});

    for (const post of posts) yield this.translateIPostToWPPost(post);
  }

  public deletePost(postId: string): void {
    //  const postIdentification = this.extractFullIdFromPostId(postId); // Remember about solving ID problem
    // this.activeBloggingPlatform.deletePost(postIdentification);
  }

  public createPost(params: WPCreatePostPayload): void {
    // this.activeBloggingPlatform.post(params.content?.rendered || "", [],  params.title?.rendered) // Add observer in the future.
  }

  public editPost(): void {

  }

  private translateICommentToWPComment(comment: IComment): WPComment {
    return {
      author: this.hashStringToInteger(comment.author.name),
      author_email: "",
      author_ip: "",
      author_name: comment.author.name,
      author_url: "",
      author_user_agent: "",
      content: {rendered: comment.getContent()},
      date: comment.publishedAt,
      date_gmt: comment.publishedAt,
      id: this.hashStringToInteger(comment.permlink),
      link: comment.generateSlug(),
      meta: {},
      parent: this.hashStringToInteger(comment.getParent().permlink),
      post: this.hashStringToInteger(comment.getTopPost().permlink),
      status: "publish",
      type: ""
    }
  }

  public getCommentById(commentsId: number): WPComment {
    const commentIdentification = this.getHivePostCommentIdentificationByWPId(commentsId); // Remember about solving ID problem
    const comment = this.bloggingPlatform.getComment(commentIdentification);
    return this.translateICommentToWPComment(comment);
  }

  public * getComments(params: WPGetCommentsParams): Iterable<WPComment> {
    const filters = {
      endTime: params.before,
      startTime: params.after,
      sortBy: params.orderby,
      order: params.order,
      searchInText: params.search,
    }
    const post = this.bloggingPlatform.getPost({author: params.author, id: params.post }) // Get proper types of this
    const comments = post.enumReplies(filters, {page: params.page || 1, pageSize: params.per_page || 100});
    for (const comment of comments) yield this.translateICommentToWPComment(comment);
  }

  public deleteComment(): void {

  }

  public createComment(): void {

  }

  public editComment(): void {

  }

  // Users - we do not want to edit or remove them

  public getUser(): WPUser {

  } 

  public getUsers(): Iterable<WPUser> {

  }


}

