import type { TAccountName } from "@hiveio/wax";
import {
  ReplyOperation,
  BlogPostOperation,
  FollowOperation,
  CommunityOperation,
  LegacyVoteOperation
} from "@hiveio/wax";
import { Account } from "./Account";
import type { DataProvider } from "./DataProvider";
import { WorkerBeeError } from "./errors";
import type {
  IAccount,
  IAccountIdentity,
  IActiveBloggingPlatform,
  IComment,
  ICommunityIdentity,
  IPost,
  IPostCommentIdentity,
  IVote,
  Observer
} from "./interfaces";
import type { ITransactionSigner } from "./signing";
import { withRetry } from "./wax";

/**
 * Generates a unique permlink for a new comment/post.
 * Format: re-{parentAuthor}-{timestamp}-{random}
 */
const generatePermlink = (parentAuthor?: string): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  if (parentAuthor)
    return `re-${parentAuthor}-${timestamp}-${random}`;

  return `post-${timestamp}-${random}`;
};

/**
 * Authenticated blogging platform with write capabilities.
 *
 * All operations are signed using the provided signer before broadcast.
 */
export class ActiveBloggingPlatform implements IActiveBloggingPlatform {
  public readonly account: TAccountName;
  public readonly signer: ITransactionSigner;

  #dataProvider: DataProvider;

  public constructor(
    signer: ITransactionSigner,
    dataProvider: DataProvider
  ) {
    this.account = signer.account;
    this.signer = signer;
    this.#dataProvider = dataProvider;
  }

  /**
   * Create a new post
   */
  public async post(
    body: string,
    tags: string[],
    title: string,
    observer?: Partial<Observer<IPost>>
  ): Promise<void> {
    const permlink = generatePermlink();
    const category = tags[0] || "blog";

    const tx = await this.#dataProvider.chain.createTransaction();

    tx.pushOperation(new BlogPostOperation({
      author: this.account,
      category,
      permlink,
      title,
      body,
      tags,
      description: body.substring(0, 160)
    }));

    await this.signer.sign(tx);

    await withRetry(async (chain) => {
      await chain.broadcast(tx);
    });

    // Notify observer of completion
    if (observer?.next) {
      const post = await this.#dataProvider.bloggingPlatform.getPost({
        author: this.account,
        permlink
      });
      observer.next(post);
    }
    observer?.complete?.();
  }

  /**
   * Reply to a post or comment
   */
  public async comment(
    parent: IPostCommentIdentity,
    body: string,
    observer?: Partial<Observer<IComment>>
  ): Promise<void> {
    const permlink = generatePermlink(parent.author);

    const tx = await this.#dataProvider.chain.createTransaction();

    tx.pushOperation(new ReplyOperation({
      parentAuthor: parent.author,
      parentPermlink: parent.permlink,
      author: this.account,
      permlink,
      body,
      title: ""
    }));

    await this.signer.sign(tx);

    await withRetry(async (chain) => {
      await chain.broadcast(tx);
    });

    // Notify observer
    if (observer?.next) {
      await this.#dataProvider.fetchPost({ author: this.account, permlink });
      const commentData = this.#dataProvider.getComment({ author: this.account, permlink });
      if (commentData)
        observer.next({
          author: this.account,
          permlink,
          publishedAt: new Date(commentData.created),
          updatedAt: new Date(commentData.updated || commentData.created),
          enumMentionedAccounts: () => Promise.resolve([]),
          enumVotes: () => Promise.resolve([]),
          getContent: () => Promise.resolve(body),
          wasVotedByUser: () => Promise.resolve(false),
          getVotesCount: () => Promise.resolve(0),
          getSlug: () => `@${this.account}/${permlink}`
        });
    }
    observer?.complete?.();
  }

  /**
   * Vote on a post or comment
   */
  public async vote(
    postOrComment: IPostCommentIdentity,
    weight: number,
    observer?: Partial<Observer<IVote>>
  ): Promise<void> {
    // Clamp weight to valid range
    const clampedWeight = Math.max(-10000, Math.min(10000, Math.round(weight)));

    const tx = await this.#dataProvider.chain.createTransaction();

    const voteOp = await LegacyVoteOperation.for(
      this.#dataProvider.chain,
      this.account,
      postOrComment.author,
      postOrComment.permlink,
      clampedWeight
    );
    tx.pushOperation(voteOp);

    await this.signer.sign(tx);

    await withRetry(async (chain) => {
      await chain.broadcast(tx);
    });

    // Notify observer
    if (observer?.next)
      observer.next({
        voter: this.account,
        weight: clampedWeight,
        upvote: clampedWeight > 0,
        parentComment: postOrComment
      });

    observer?.complete?.();
  }

  /**
   * Reblog (resteem) a post
   */
  public async reblog(post: IPostCommentIdentity): Promise<void> {
    const tx = await this.#dataProvider.chain.createTransaction();

    tx.pushOperation(
      new FollowOperation().reblog(this.account, post.author, post.permlink)
    );

    await this.signer.sign(tx);

    await withRetry(async (chain) => {
      await chain.broadcast(tx);
    });
  }

  /**
   * Delete a post (only works if no votes/replies)
   */
  public async deletePost(post: IPostCommentIdentity): Promise<void> {
    if (post.author !== this.account)
      throw new WorkerBeeError("Can only delete your own posts");

    const tx = await this.#dataProvider.chain.createTransaction();

    tx.pushOperation({
      delete_comment_operation: {
        author: post.author,
        permlink: post.permlink
      }
    });

    await this.signer.sign(tx);

    await withRetry(async (chain) => {
      await chain.broadcast(tx);
    });
  }

  /**
   * Edit an existing post
   */
  public async editPost(
    post: IPostCommentIdentity,
    body: string,
    tags: string[],
    title: string,
    observer?: Partial<Observer<IPost>>
  ): Promise<void> {
    // Fetch existing post to get parent info
    await this.#dataProvider.fetchPost(post);
    const existingPost = this.#dataProvider.getComment(post);
    const category = existingPost?.category || tags[0] || "blog";

    const tx = await this.#dataProvider.chain.createTransaction();

    tx.pushOperation(new BlogPostOperation({
      author: post.author,
      category,
      permlink: post.permlink,
      title,
      body,
      tags,
      description: body.substring(0, 160)
    }));

    await this.signer.sign(tx);

    await withRetry(async (chain) => {
      await chain.broadcast(tx);
    });

    // Notify observer
    if (observer?.next) {
      const updatedPost = await this.#dataProvider.bloggingPlatform.getPost(post);
      observer.next(updatedPost);
    }
    observer?.complete?.();
  }

  /**
   * Delete a comment (only works if no votes/replies)
   */
  public async deleteComment(comment: IPostCommentIdentity): Promise<void> {
    if (comment.author !== this.account)
      throw new WorkerBeeError("Can only delete your own comments");

    const tx = await this.#dataProvider.chain.createTransaction();

    tx.pushOperation({
      delete_comment_operation: {
        author: comment.author,
        permlink: comment.permlink
      }
    });

    await this.signer.sign(tx);

    await withRetry(async (chain) => {
      await chain.broadcast(tx);
    });
  }

  /**
   * Edit an existing comment
   */
  public async editComment(
    comment: IPostCommentIdentity,
    body: string,
    observer?: Partial<Observer<IComment>>
  ): Promise<void> {
    // Fetch existing comment to get parent info
    await this.#dataProvider.fetchPost(comment);
    const existingComment = this.#dataProvider.getComment(comment);

    if (!existingComment)
      throw new WorkerBeeError("Comment not found");

    const tx = await this.#dataProvider.chain.createTransaction();

    tx.pushOperation(new ReplyOperation({
      parentAuthor: existingComment.parent_author || "",
      parentPermlink: existingComment.parent_permlink || "",
      author: comment.author,
      permlink: comment.permlink,
      body,
      title: ""
    }));

    await this.signer.sign(tx);

    await withRetry(async (chain) => {
      await chain.broadcast(tx);
    });

    // Notify observer
    if (observer?.next)
      observer.next({
        author: comment.author,
        permlink: comment.permlink,
        publishedAt: new Date(existingComment.created),
        updatedAt: new Date(),
        enumMentionedAccounts: () => Promise.resolve([]),
        enumVotes: () => Promise.resolve([]),
        getContent: () => Promise.resolve(body),
        wasVotedByUser: () => Promise.resolve(false),
        getVotesCount: () => Promise.resolve(0),
        getSlug: () => `@${comment.author}/${comment.permlink}`
      });

    observer?.complete?.();
  }

  /**
   * Follow a blog or subscribe to a community
   */
  public async follow(target: IAccountIdentity | ICommunityIdentity): Promise<void> {
    const targetName = target.name;
    const isCommunity = targetName.startsWith("hive-");

    const tx = await this.#dataProvider.chain.createTransaction();

    if (isCommunity)
      tx.pushOperation(new CommunityOperation().subscribe(targetName));
    else
      tx.pushOperation(new FollowOperation().followBlog(this.account, targetName));

    await this.signer.sign(tx);

    await withRetry(async (chain) => {
      await chain.broadcast(tx);
    });
  }

  /**
   * Unfollow a blog or unsubscribe from a community
   */
  public async unfollow(target: IAccountIdentity | ICommunityIdentity): Promise<void> {
    const targetName = target.name;
    const isCommunity = targetName.startsWith("hive-");

    const tx = await this.#dataProvider.chain.createTransaction();

    if (isCommunity)
      tx.pushOperation(new CommunityOperation().unsubscribe(targetName));
    else
      tx.pushOperation(new FollowOperation().unfollowBlog(this.account, targetName));

    await this.signer.sign(tx);

    await withRetry(async (chain) => {
      await chain.broadcast(tx);
    });
  }

  /**
   * Mute an account (hide their content from your feed)
   */
  public async mute(account: IAccountIdentity): Promise<void> {
    const tx = await this.#dataProvider.chain.createTransaction();

    tx.pushOperation(new FollowOperation().muteBlog(this.account, account.name));

    await this.signer.sign(tx);

    await withRetry(async (chain) => {
      await chain.broadcast(tx);
    });
  }

  /**
   * Unmute an account
   */
  public async unmute(account: IAccountIdentity): Promise<void> {
    const tx = await this.#dataProvider.chain.createTransaction();

    tx.pushOperation(new FollowOperation().unmuteBlog(this.account, account.name));

    await this.signer.sign(tx);

    await withRetry(async (chain) => {
      await chain.broadcast(tx);
    });
  }

  /**
   * Get account information
   */
  public async getAccount(accountName: string): Promise<IAccount> {
    await this.#dataProvider.fetchAccount(accountName);
    return new Account(accountName, this.#dataProvider);
  }
}
