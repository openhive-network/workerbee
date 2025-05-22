import { comment, TAccountName } from "@hiveio/wax";
import { WorkerBeeArrayIterable, WorkerBeeIterable } from "../../types/iterator";
import { calculateRelativeTime } from "../../utils/time";
import { BlockHeaderClassifier, ContentClassifier } from "../classifiers";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { IOperationTransactionPair, OperationClassifier } from "../classifiers/operation-classifier";
import { DataEvaluationContext } from "../factories/data-evaluation-context";
import { ICommentData } from "../filters/blog-content-filter";
import { ProviderBase } from "./provider-base";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000; // One week in milliseconds

// Common interface for blog content data (posts and comments)
export type TBlogContentProvided<TAccounts extends Array<TAccountName>> = {
  [K in TAccounts[number]]: Array<IOperationTransactionPair<comment>> | WorkerBeeIterable<IOperationTransactionPair<comment>>;
};

// Comment provider implementation
export interface ICommentProviderAuthors {
  account: string;
  parentCommentFilter?: ICommentData;
}

export interface ICommentProviderOptions {
  authors: ICommentProviderAuthors[];
  collectPostMetadataAfter?: string;
}

// Post provider implementation
export interface IPostProviderOptions {
  authors: string[];
  collectPostMetadataAfter?: string;
}

export interface ICommentProviderData<TAccounts extends Array<TAccountName>> {
  comments: Partial<TBlogContentProvided<TAccounts>>;
}

export interface IPostProviderData<TAccounts extends Array<TAccountName>> {
  posts: Partial<TBlogContentProvided<TAccounts>>;
}

export interface IAuthorsOptions {
  commentData?: ICommentData;
  collectPostMetadataAfter?: number;
}

// Base class for blog content providers (posts and comments)
export abstract class BlogContentProvider<
  TAccounts extends Array<TAccountName> = Array<TAccountName>,
  TOptions extends object = object
> extends ProviderBase<TOptions> {
  public readonly authors = new Map<TAccountName, IAuthorsOptions>();
  protected readonly isPost: boolean;

  public constructor(isPost: boolean) {
    super();
    this.isPost = isPost;
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [OperationClassifier];
  }

  public abstract pushOptions(options: TOptions): void;

  public async createProviderData(data: DataEvaluationContext): Promise<TBlogContentProvided<TAccounts>> {
    const result = {} as TBlogContentProvided<TAccounts>;

    const { timestamp } = await data.get(BlockHeaderClassifier);

    const accounts = await data.get(OperationClassifier);
    if (accounts.operationsPerType.comment)
      for (const operation of accounts.operationsPerType.comment) {
        // Check if post/comment type matches what we're looking for
        const isPostContent = operation.operation.parent_author === "";
        if (this.isPost !== isPostContent)
          continue;

        /// If requested account is a post author
        if(this.authors.get(operation.operation.author)?.commentData === undefined)
          continue;

        let account = operation.operation.author;

        /// If requested account is a comment parent-author
        const parentCommentFilter = this.authors.get(operation.operation.author)!;

        if(!this.isPost && parentCommentFilter.commentData && operation.operation.parent_permlink !== parentCommentFilter.commentData.parentPermlink)
          continue;
        else
          account = operation.operation.parent_author;

        if (!result[account])
          result[account] = new WorkerBeeArrayIterable<IOperationTransactionPair<comment>>();

        const storage = result[account] as WorkerBeeArrayIterable<IOperationTransactionPair<comment>>;

        // Dynamically inject options for the content classifier when post is created
        if (parentCommentFilter.collectPostMetadataAfter && data.hasClassifierRegistered(ContentClassifier))
          data.pushClassifierOptions(ContentClassifier, {
            account,
            permlink: operation.operation.permlink,
            rollbackContractAfter: new Date(timestamp.getTime() + parentCommentFilter.collectPostMetadataAfter)
          });

        storage.push({
          operation: operation.operation,
          transaction: operation.transaction
        });
      }

    return result;
  }
}

export class CommentProvider<TAccounts extends Array<TAccountName> = Array<TAccountName>> extends BlogContentProvider<TAccounts, ICommentProviderOptions> {
  public constructor() {
    super(false); // False = not posts, i.e., comments
  }

  public pushOptions(options: ICommentProviderOptions): void {
    for (const { account, parentCommentFilter } of options.authors)
      this.authors.set(account, {
        collectPostMetadataAfter: options.collectPostMetadataAfter ? (
          ONE_WEEK_MS + (Date.now() - calculateRelativeTime(options.collectPostMetadataAfter).getTime())
        ) : undefined,
        commentData: parentCommentFilter
      });
  }

  public async provide(data: DataEvaluationContext): Promise<ICommentProviderData<TAccounts>> {
    return {
      comments: await this.createProviderData(data)
    };
  }
}

export class PostProvider<TAccounts extends Array<TAccountName> = Array<TAccountName>> extends BlogContentProvider<TAccounts, IPostProviderOptions> {
  public constructor() {
    super(true); // True = posts
  }

  public pushOptions(options: IPostProviderOptions): void {
    for (const account of options.authors)
      this.authors.set(account, {
        collectPostMetadataAfter: options.collectPostMetadataAfter ? (
          ONE_WEEK_MS + (Date.now() - calculateRelativeTime(options.collectPostMetadataAfter).getTime())
        ) : undefined
      });
  }

  public async provide(data: DataEvaluationContext): Promise<IPostProviderData<TAccounts>> {
    return {
      posts: await this.createProviderData(data)
    };
  }
}

