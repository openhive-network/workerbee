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

export class CommentFilter extends FilterBase {
  public constructor(
    worker: WorkerBee,
    private readonly account: string,
    private readonly parentCommentFilter?: ICommentData
  ) {
    super(worker);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      OperationClassifier
    ];
  }

  public async match(data: DataEvaluationContext): Promise<boolean> {
    const { operationsPerType } = await data.get(OperationClassifier);

    if (operationsPerType.comment)
      for(const { operation } of operationsPerType.comment) {
        if (operation.parent_author === "")
          continue;

        if (operation.author !== this.account)
          continue;

        if(this.parentCommentFilter && (
          operation.parent_permlink !== this.parentCommentFilter.parentPermlink
          || operation.parent_author !== this.parentCommentFilter.parentAuthor
        ))
          continue;

        return true;
      }

    return false;
  }
}
