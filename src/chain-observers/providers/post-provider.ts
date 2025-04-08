import { comment, TAccountName } from "@hiveio/wax";
import { WorkerBeeIterable } from "../../types/iterator";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { IOperationTransactionPair, OperationClassifier } from "../classifiers/operation-classifier";
import { DataEvaluationContext } from "../factories/data-evaluation-context";
import { ProviderBase } from "./provider-base";

export type TPostProvided<TAccounts extends Array<TAccountName>> = {
  [K in TAccounts[number]]: WorkerBeeIterable<IOperationTransactionPair<comment>>;
};

export interface IPostProviderData<TAccounts extends Array<TAccountName>> {
  posts: Partial<TPostProvided<TAccounts>>;
};

export interface IPostProviderOptions {
  authors: string[];
}

export class PostProvider<TAccounts extends Array<TAccountName> = Array<TAccountName>> extends ProviderBase<IPostProviderOptions> {
  public readonly authors = new Set<TAccountName>();

  public pushOptions(options: IPostProviderOptions): void {
    for(const account of options.authors)
      this.authors.add(account);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [OperationClassifier]
  }

  public async provide(data: DataEvaluationContext): Promise<IPostProviderData<TAccounts>> {
    const result = {
      posts: {}
    } as IPostProviderData<TAccounts>;

    const accounts = await data.get(OperationClassifier);
    if (accounts.operationsPerType.comment)
      for(const operation of accounts.operationsPerType.comment) {
        if (operation.operation.parent_author !== "")
          continue;

        for(const account of this.authors) {
          if(operation.operation.author !== account)
            continue;

          if (!result.posts[account])
            result.posts[account] = [];

          result.posts[account].push({
            operation: operation.operation,
            transaction: operation.transaction
          });
        }
      }

    for(const account in result.posts)
      result.posts[account] = new WorkerBeeIterable(result.posts[account]);

    return result;
  }
}
