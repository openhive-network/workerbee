import { EFollowActions, TAccountName } from "@hiveio/wax";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { IOperationTransactionPair, OperationClassifier } from "../classifiers/operation-classifier";
import { DataEvaluationContext } from "../factories/data-evaluation-context";
import { ProviderBase } from "./provider-base";

export interface IFollowOperation {
  follower: TAccountName;
  following: TAccountName;
  what: EFollowActions;
}

export type TFollowProvided<TAccounts extends Array<TAccountName>> = {
  [K in TAccounts[number]]: Array<IOperationTransactionPair<IFollowOperation>>;
};

export interface IFollowProviderData<TAccounts extends Array<TAccountName>> {
  follows: Partial<TFollowProvided<TAccounts>>;
};

export interface IFollowProviderOptions {
  accounts: TAccountName[];
}

export class FollowProvider<TAccounts extends Array<TAccountName> = Array<string>> extends ProviderBase<IFollowProviderOptions> {
  public readonly accounts = new Set<string>();

  public pushOptions(options: IFollowProviderOptions): void {
    for(const account of options.accounts)
      this.accounts.add(account);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [OperationClassifier]
  }

  public async provide(data: DataEvaluationContext): Promise<IFollowProviderData<TAccounts>> {
    const result = {
      follows: {}
    } as IFollowProviderData<TAccounts>;

    const accounts = await data.get(OperationClassifier);
    if (accounts.operationsPerType.custom_json)
      for(const operation of accounts.operationsPerType.custom_json) {
        if (operation.operation.id !== "follow")
          continue;
        const json = JSON.parse(operation.operation.json);

        const follower = json[1].follower;

        if (json[0] !== "follow" || !follower || !this.accounts.has(follower))
          continue;

        if (!result.follows[follower])
          result.follows[follower] = [];

        result.follows[follower].push({
          operation: {
            follower,
            following: json[1].following,
            what: json[1].what
          },
          transaction: operation.transaction
        });
      }

    return result;
  }
}
