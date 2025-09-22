import { TAccountName } from "@hiveio/wax";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { ContentMetadataClassifier, TContentMetadataAuthorData } from "../classifiers/content-metadata-classifier";
import { TProviderEvaluationContext } from "../factories/data-evaluation-context";
import { ProviderBase } from "./provider-base";

// Common interface for blog content data (posts and comments)
export type TContentMetadataProvided<TAccounts extends Array<TAccountName>> = {
  [K in TAccounts[number]]: TContentMetadataAuthorData;
};

// Comment metadata provider implementation
export interface ICommentMetadataProviderOptions {
  authors: TAccountName[];
}

// Post metadata provider implementation
export interface IPostMetadataProviderOptions {
  authors: TAccountName[];
}

export interface ICommentMetadataProviderData<TAccounts extends Array<TAccountName>> {
  commentsMetadata: Partial<TContentMetadataProvided<TAccounts>>;
}

export interface IPostMetadataProviderData<TAccounts extends Array<TAccountName>> {
  postsMetadata: Partial<TContentMetadataProvided<TAccounts>>;
}

// Base class for blog content providers (posts and comments)
export abstract class ContentMetadataProvider<
  TStructure extends object = object,
  TAccounts extends Array<TAccountName> = Array<TAccountName>,
  TOptions extends object = object
> extends ProviderBase<TOptions, TStructure> {
  public readonly authors = new Set<TAccountName>();
  protected readonly isPost: boolean;

  public constructor(isPost: boolean) {
    super();
    this.isPost = isPost;
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [ContentMetadataClassifier];
  }

  public abstract pushOptions(options: TOptions): void;

  public async createProviderData(data: TProviderEvaluationContext): Promise<Partial<TContentMetadataProvided<TAccounts>>> {
    const { contentData } = await data.get(ContentMetadataClassifier);

    const result: Partial<TContentMetadataProvided<TAccounts>> = {};
    for (const account of this.authors)
      if (contentData[account])
        for(const permlink in contentData[account]) {
          const postMetadata = contentData[account][permlink];

          const postIndicator = postMetadata.parentAuthor === "";
          if (this.isPost !== postIndicator)
            continue;

          result[account] = result[account] ?? {};
          result[account][permlink] = postMetadata;
        }

    return result;
  }
}

export class CommentMetadataProvider<TAccounts extends Array<TAccountName> = Array<TAccountName>>
  extends ContentMetadataProvider<ICommentMetadataProviderData<TAccounts>, TAccounts, ICommentMetadataProviderOptions> {
  public constructor() {
    super(false); // False = not posts, i.e., comments
  }

  public pushOptions(options: ICommentMetadataProviderOptions): void {
    for (const account of options.authors)
      this.authors.add(account);
  }

  public get baseStructure(): ICommentMetadataProviderData<TAccounts> {
    return {
      commentsMetadata: {}
    };
  }

  public async provide(data: TProviderEvaluationContext): Promise<ICommentMetadataProviderData<TAccounts>> {
    const result = this.baseStructure;

    result.commentsMetadata = await this.createProviderData(data);

    return result;
  }
}

export class PostMetadataProvider<TAccounts extends Array<TAccountName> = Array<TAccountName>>
  extends ContentMetadataProvider<IPostMetadataProviderData<TAccounts>, TAccounts, IPostMetadataProviderOptions> {
  public constructor() {
    super(true); // True = posts
  }

  public pushOptions(options: IPostMetadataProviderOptions): void {
    for (const account of options.authors)
      this.authors.add(account);
  }

  public get baseStructure(): IPostMetadataProviderData<TAccounts> {
    return {
      postsMetadata: {}
    };
  }

  public async provide(data: TProviderEvaluationContext): Promise<IPostMetadataProviderData<TAccounts>> {
    const result = this.baseStructure;

    result.postsMetadata = await this.createProviderData(data);

    return result;
  }
}

