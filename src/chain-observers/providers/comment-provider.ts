import { comment, TAccountName } from "@hiveio/wax";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { IOperationTransactionPair, OperationClassifier } from "../classifiers/operation-classifier";
import { DataEvaluationContext } from "../factories/data-evaluation-context";
import { ProviderBase } from "./provider-base";

export type TCommentProvided<TAccounts extends Array<TAccountName>> = {
  [K in TAccounts[number]]: Array<IOperationTransactionPair<comment>>;
};

export interface ICommentProviderData<TAccounts extends Array<TAccountName>> {
  comments: Partial<TCommentProvided<TAccounts>>;
};

export interface ICommentProviderAuthors {
  account: string;
  permlink?: string;
}

export interface ICommentProviderOptions {
  authors: ICommentProviderAuthors[];
}

export class CommentProvider<TAccounts extends Array<TAccountName> = Array<TAccountName>> extends ProviderBase<ICommentProviderOptions> {
  public readonly authors = new Map<TAccountName, string | undefined>();

  public pushOptions(options: ICommentProviderOptions): void {
    for(const { account, permlink } of options.authors)
      this.authors.set(account, permlink);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [OperationClassifier]
  }

  public async provide(data: DataEvaluationContext): Promise<ICommentProviderData<TAccounts>> {
    const result = {
      comments: {}
    } as ICommentProviderData<TAccounts>;

    const accounts = await data.get(OperationClassifier);
    if (accounts.operationsPerType.comment)
      for(const operation of accounts.operationsPerType.comment) {
        if (operation.operation.parent_author === "")
          continue;

        for(const [account, permlink] of this.authors) {
          if (operation.operation.author !== account)
            continue;

          if(permlink && operation.operation.parent_permlink !== permlink)
            continue;

          if (!result.comments[account])
            result.comments[account] = [];

          result.comments[account].push({
            operation: operation.operation,
            transaction: operation.transaction
          });
        }
      }

    return result;
  }
}
