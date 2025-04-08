import { TAccountName } from "@hiveio/wax";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { IOperationTransactionPair, OperationClassifier } from "../classifiers/operation-classifier";
import { DataEvaluationContext } from "../factories/data-evaluation-context";
import { ProviderBase } from "./provider-base";

export interface IReblogOperation {
  account: TAccountName;
  author: TAccountName;
  permlink: string;
}

export type TReblogProvided<TAccounts extends Array<TAccountName>> = {
  [K in TAccounts[number]]: Array<IOperationTransactionPair<IReblogOperation>>;
};

export interface IReblogProviderData<TAccounts extends Array<TAccountName>> {
  reblogs: TReblogProvided<TAccounts>;
};

export interface IReblogProviderOptions {
  accounts: TAccountName[];
}

export class ReblogProvider<TAccounts extends Array<TAccountName> = Array<string>> extends ProviderBase<IReblogProviderOptions> {
  public readonly accounts = new Set<string>();

  public pushOptions(options: IReblogProviderOptions): void {
    for(const account of options.accounts)
      this.accounts.add(account);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [OperationClassifier]
  }

  public async provide(data: DataEvaluationContext): Promise<IReblogProviderData<TAccounts>> {
    const result = {
      reblogs: {}
    } as IReblogProviderData<TAccounts>;

    const accounts = await data.get(OperationClassifier);
    if (accounts.operationsPerType.custom_json)
      for(const operation of accounts.operationsPerType.custom_json) {
        if (operation.operation.id !== "follow")
          continue;
        const json = JSON.parse(operation.operation.json);

        const reblogger = json[1].account;

        if (json[0] !== "reblog" || !reblogger || !this.accounts.has(reblogger))
          continue;

        if (!result.reblogs[reblogger])
          result.reblogs[reblogger] = [];

        result.reblogs[reblogger].push({
          operation: {
            account: reblogger,
            author: json[1].author,
            permlink: json[1].permlink
          },
          transaction: operation.transaction
        });
      }

    return result;
  }
}
