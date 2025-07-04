import type { comment, TAccountName } from "@hiveio/wax";
import type { WorkerBee } from "../../bot";
import { ContentMetadataClassifier, ImpactedAccountClassifier, OperationClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { TFilterEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

// Base class for content filters (posts and comments)
export abstract class BlogContentMetadataFilter extends FilterBase {
  public constructor(
    worker: WorkerBee,
    private readonly reportAfterMsBeforePayout: number,
    accounts: TAccountName[],
    protected readonly isPost: boolean
  ) {
    super(worker);

    this.accounts = new Set(accounts);
  }

  protected readonly accounts: Set<TAccountName>;

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      ContentMetadataClassifier,
      OperationClassifier,
      ImpactedAccountClassifier
    ];
  }

  private queriedPosts: comment[] = [];

  public async match(data: TFilterEvaluationContext): Promise<boolean> {
    const { operationsPerType } = await data.get(OperationClassifier);

    const queryComments: comment[] = [...this.queriedPosts];
    this.queriedPosts = []; // Reset for next match

    if (operationsPerType.comment_operation)
      for(const { operation } of operationsPerType.comment_operation) {
        // Check if post/comment type matches what we're looking for
        const postIndicator = operation.parent_author === "";
        if (this.isPost !== postIndicator)
          continue;

        // Check author match
        if (!this.accounts.has(operation.author))
          continue;

        queryComments.push(operation);
      }

    if (queryComments.length > 0) {
      const comments = await data.query(ContentMetadataClassifier, {
        requestedData: queryComments,
        reportAfterMsBeforePayout: this.reportAfterMsBeforePayout
      });

      for(const operation of queryComments)
        if (!comments[operation.author] || !comments[operation.author][operation.permlink])
          this.queriedPosts.push(operation); // Add back to queried posts if not found

    }

    const { contentData } = await data.get(ContentMetadataClassifier);
    for(const _ in contentData)
      return true;

    return false;
  }
}

// Filter for comments (replies to posts or other comments)
export class CommentMetadataFilter extends BlogContentMetadataFilter {
  public constructor(
    worker: WorkerBee,
    reportAfterMsBeforePayout: number,
    accounts: TAccountName[]
  ) {
    super(worker, reportAfterMsBeforePayout, accounts, false);
  }
}

// Filter for posts (top-level content with empty parent_author)
export class PostMetadataFilter extends BlogContentMetadataFilter {
  public constructor(
    worker: WorkerBee,
    reportAfterMsBeforePayout: number,
    accounts: TAccountName[]
  ) {
    super(worker, reportAfterMsBeforePayout, accounts, true);
  }
}
