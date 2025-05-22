import { TAccountName } from "@hiveio/wax";
import type { WorkerBee } from "../../bot";
import { ContentClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { DataEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export interface ICommentData {
  parentAuthor: TAccountName;
  parentPermlink: string;
}

// Base class for content filters (posts and comments)
export abstract class ContentMetadataFilter extends FilterBase {
  public constructor(
    worker: WorkerBee,
    accounts: string[],
    protected readonly isPost: boolean,
    protected readonly parentCommentFilter?: ICommentData
  ) {
    super(worker);

    this.accounts = new Set(accounts);
  }

  protected readonly accounts: Set<string>;

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      ContentClassifier
    ];
  }

  public async match(data: DataEvaluationContext): Promise<boolean> {
    const { contentData } = await data.get(ContentClassifier);

    for(const account in contentData) {
      if (!this.accounts.has(account))
        continue;
      const content = contentData[account];
      for(const permlink in content) {
        const operation = content[permlink];
        // Check if post/comment type matches what we're looking for
        const postIndicator = operation.parentAuthor && operation.parentAuthor === "";
        if (this.isPost !== postIndicator)
          continue;

        // Check parent data if specified
        if (!this.isPost && this.parentCommentFilter && (
          operation.parentPermlink !== this.parentCommentFilter.parentPermlink
          || operation.parentAuthor !== this.parentCommentFilter.parentAuthor
        ))
          continue;

        return true;
      }
    }

    return false;
  }
}

// Filter for comments (replies to posts or other comments)
export class CommentContentMetadataFilter extends ContentMetadataFilter {
  public constructor(
    worker: WorkerBee,
    accounts: string[],
    parentCommentFilter?: ICommentData
  ) {
    super(worker, accounts, false, parentCommentFilter);
  }
}

// Filter for posts (top-level content with empty parent_author)
export class PostContentMetadataFilter extends ContentMetadataFilter {
  public constructor(
    worker: WorkerBee,
    accounts: string[]
  ) {
    super(worker, accounts, true);
  }
}
