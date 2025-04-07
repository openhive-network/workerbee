import { TAccountName, vote } from "@hiveio/wax";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { IOperationTransactionPair, OperationClassifier } from "../classifiers/operation-classifier";
import { DataEvaluationContext } from "../factories/data-evaluation-context";
import { ProviderBase } from "./provider-base";

export type TVoteProvided<TAccounts extends Array<TAccountName>> = {
  [K in TAccounts[number]]: Array<IOperationTransactionPair<vote>>;
};

export interface IVoteProviderData<TAccounts extends Array<TAccountName>> {
  votes: TVoteProvided<TAccounts>;
};

export interface IVoteProviderOptions {
  voters: string[];
}

export class VoteProvider<TAccounts extends Array<TAccountName> = Array<TAccountName>> extends ProviderBase<IVoteProviderOptions> {
  public readonly voters: string[] = [];

  public pushOptions(options: IVoteProviderOptions): void {
    this.voters.push(...options.voters);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [OperationClassifier]
  }

  public async provide(data: DataEvaluationContext): Promise<IVoteProviderData<TAccounts>> {
    const result = {
      votes: {}
    } as IVoteProviderData<TAccounts>;

    const operations = await data.get(OperationClassifier);
    if (operations.operationsPerType.vote)
      for(const operation of operations.operationsPerType.vote)
        for(const account of this.voters) {
          if(operation.operation.voter !== account)
            continue;

          if (!result.votes[account])
            result.votes[account] = [];

          result.votes[account].push({
            operation: operation.operation,
            transaction: operation.transaction
          });
        }

    return result;
  }
}
