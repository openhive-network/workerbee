import { TAccountName, vote } from "@hiveio/wax";
import { WorkerBeeArrayIterable, WorkerBeeIterable } from "../../types/iterator";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { IOperationTransactionPair, OperationClassifier } from "../classifiers/operation-classifier";
import { DataEvaluationContext } from "../factories/data-evaluation-context";
import { ProviderBase } from "./provider-base";

export type TVoteProvided<TAccounts extends Array<TAccountName>> = {
  [K in TAccounts[number]]: WorkerBeeIterable<IOperationTransactionPair<vote>>;
};

export interface IVoteProviderData<TAccounts extends Array<TAccountName>> {
  votes: Partial<TVoteProvided<TAccounts>>;
};

export interface IVoteProviderOptions {
  voters: string[];
}

export class VoteProvider<TAccounts extends Array<TAccountName> = Array<TAccountName>> extends ProviderBase<IVoteProviderOptions> {
  public readonly voters = new Set<TAccountName>();

  public pushOptions(options: IVoteProviderOptions): void {
    for(const account of options.voters)
      this.voters.add(account);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [OperationClassifier]
  }

  public async provide(data: DataEvaluationContext): Promise<IVoteProviderData<TAccounts>> {
    const result = {
      votes: {}
    } as IVoteProviderData<TAccounts>;

    const operations = await data.get(OperationClassifier);
    if (operations.operationsPerType.vote_operation)
      for(const operation of operations.operationsPerType.vote_operation) {
        if(this.voters.has(operation.operation.voter) === false)
          continue;

        const account = operation.operation.voter;

        if (!result.votes[account])
          result.votes[account] = new WorkerBeeArrayIterable();

        const storage = result.votes[account] as WorkerBeeArrayIterable<IOperationTransactionPair<vote>>;
        storage.push({
          operation: operation.operation,
          transaction: operation.transaction
        });
      }

    return result;
  }
}
