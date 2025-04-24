import { TAccountName } from "@hiveio/wax";
import type { WorkerBee } from "../../bot";
import { OperationClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { DataEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export interface ICommentData {
  parentAuthor: TAccountName;
  parentPermlink: string;
}

// Base class for content filters (posts and comments)
export abstract class BlogContentFilter extends FilterBase {
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
      OperationClassifier
    ];
  }

  public async match(data: DataEvaluationContext): Promise<boolean> {
    const { operationsPerType } = await data.get(OperationClassifier);

    if (operationsPerType.comment)
      for(const { operation } of operationsPerType.comment) {
        // Check if post/comment type matches what we're looking for
        const postIndicator = operation.parent_author === "";
        if (this.isPost !== postIndicator)
          continue;

        // Check author match
        if (this.accounts.has(operation.author))
          continue;

        // Check parent data if specified
        if (!this.isPost && this.parentCommentFilter && (
          operation.parent_permlink !== this.parentCommentFilter.parentPermlink
          || operation.parent_author !== this.parentCommentFilter.parentAuthor
        ))
          continue;

        return true;
      }


    return false;
  }
}

// Filter for comments (replies to posts or other comments)
export class CommentFilter extends BlogContentFilter {
  public constructor(
    worker: WorkerBee,
    accounts: string[],
    parentCommentFilter?: ICommentData
  ) {
    super(worker, accounts, false, parentCommentFilter);
  }
}

// Filter for posts (top-level content with empty parent_author)
export class PostFilter extends BlogContentFilter {
  public constructor(
    worker: WorkerBee,
    accounts: string[]
  ) {
    super(worker, accounts, true);
  }
}
