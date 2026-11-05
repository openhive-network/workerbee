import { TAccountName } from "@hiveio/wax";
import { OperationClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { TFilterEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export interface ICommentData {
  parentAuthor: TAccountName;
  parentPermlink: string;
}

// Base class for content filters (posts and comments)
export abstract class BlogContentFilter extends FilterBase {
  protected readonly isPost: boolean;
  protected readonly parentCommentFilter?: ICommentData;

  public constructor(
    accounts: string[],
    isPost: boolean,
    parentCommentFilter?: ICommentData
  ) {
    super();

    this.isPost = isPost;
    this.parentCommentFilter = parentCommentFilter;

    this.accounts = new Set(accounts);
  }

  protected readonly accounts: Set<string>;

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      OperationClassifier
    ];
  }

  public async match(data: TFilterEvaluationContext): Promise<boolean> {
    const { operationsPerType } = await data.get(OperationClassifier);

    if (operationsPerType.comment_operation)
      for(const { operation } of operationsPerType.comment_operation) {
        // Check if post/comment type matches what we're looking for
        const postIndicator = operation.parent_author === "";
        if (this.isPost !== postIndicator)
          continue;

        // Check author match
        if (!this.accounts.has(operation.author))
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
    accounts: string[],
    parentCommentFilter?: ICommentData
  ) {
    super(accounts, false, parentCommentFilter);
  }
}

// Filter for posts (top-level content with empty parent_author)
export class PostFilter extends BlogContentFilter {
  public constructor(
    accounts: string[]
  ) {
    super(accounts, true);
  }
}
