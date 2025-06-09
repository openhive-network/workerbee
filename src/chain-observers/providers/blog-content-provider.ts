import { comment, TAccountName } from "@hiveio/wax";
import { WorkerBeeArrayIterable, WorkerBeeIterable } from "../../types/iterator";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { IOperationTransactionPair, OperationClassifier } from "../classifiers/operation-classifier";
import { TProviderEvaluationContext } from "../factories/data-evaluation-context";
import { ICommentData } from "../filters/blog-content-filter";
import { ProviderBase } from "./provider-base";

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
}

// Post provider implementation
export interface IPostProviderOptions {
  authors: string[];
}

export interface ICommentProviderData<TAccounts extends Array<TAccountName>> {
  comments: Partial<TBlogContentProvided<TAccounts>>;
}

export interface IPostProviderData<TAccounts extends Array<TAccountName>> {
  posts: Partial<TBlogContentProvided<TAccounts>>;
}

// Base class for blog content providers (posts and comments)
export abstract class BlogContentProvider<
  TAccounts extends Array<TAccountName> = Array<TAccountName>,
  TOptions extends object = object
> extends ProviderBase<TOptions> {
  public readonly authors = new Map<TAccountName, ICommentData | undefined>();
  protected readonly isPost: boolean;

  public constructor(isPost: boolean) {
    super();
    this.isPost = isPost;
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [OperationClassifier];
  }

  public abstract pushOptions(options: TOptions): void;

  public async createProviderData(data: TProviderEvaluationContext): Promise<TBlogContentProvided<TAccounts>> {
    const result = {} as TBlogContentProvided<TAccounts>;

    const accounts = await data.get(OperationClassifier);
    if (accounts.operationsPerType.comment)
      for (const operation of accounts.operationsPerType.comment) {
        // Check if post/comment type matches what we're looking for
        const isPostContent = operation.operation.parent_author === "";
        if (this.isPost !== isPostContent)
          continue;

        /// If requested account is a post author
        if(this.authors.has(operation.operation.author) === false)
          continue;

        let account = operation.operation.author;

        /// If requested account is a comment parent-author
        const parentCommentFilter = this.authors.get(operation.operation.author);

        if(!this.isPost && parentCommentFilter && operation.operation.parent_permlink !== parentCommentFilter.parentPermlink)
          continue;
        else
          account = operation.operation.parent_author;

        if (!result[account])
          result[account] = new WorkerBeeArrayIterable<IOperationTransactionPair<comment>>();

        const storage = result[account] as WorkerBeeArrayIterable<IOperationTransactionPair<comment>>;

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
      this.authors.set(account, parentCommentFilter);
  }

  public async provide(data: TProviderEvaluationContext): Promise<ICommentProviderData<TAccounts>> {
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
      this.authors.set(account, undefined);
  }

  public async provide(data: TProviderEvaluationContext): Promise<IPostProviderData<TAccounts>> {
    return {
      posts: await this.createProviderData(data)
    };
  }
}

