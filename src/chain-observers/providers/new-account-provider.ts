import { TPublicKey } from "@hiveio/beekeeper";
import { authority, TAccountName } from "@hiveio/wax";
import { WorkerBeeIterable } from "../../types/iterator";
import { OperationClassifier } from "../classifiers";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { DataEvaluationContext } from "../factories/data-evaluation-context";
import { ProviderBase } from "./provider-base";

export type TNewAccountProvided = {
  accountName: TAccountName;
  creator: TAccountName;
  owner: authority;
  active: authority;
  posting: authority;
  memo: TPublicKey;
  jsonMetadata: Record<string, unknown>;
};

export interface INewAccountProviderData {
  newAccounts: WorkerBeeIterable<TNewAccountProvided>;
};

export class NewAccountProvider extends ProviderBase {
  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [OperationClassifier];
  }

  public async provide(data: DataEvaluationContext): Promise<INewAccountProviderData> {
    const result: TNewAccountProvided[] = [];

    const { operationsPerType } = await data.get(OperationClassifier);

    const operations = [
      ...(operationsPerType.create_claimed_account ?? []),
      ...(operationsPerType.account_create ?? []),
      ...(operationsPerType.account_create_with_delegation ?? [])
    ];

    for(const { operation } of operations)
      result.push({
        accountName: operation.new_account_name,
        active: operation.active!,
        creator: operation.creator,
        jsonMetadata: JSON.parse(operation.json_metadata),
        memo: operation.memo_key,
        owner: operation.owner!,
        posting: operation.posting!,
      });

    return {
      newAccounts: new WorkerBeeIterable(result)
    } as INewAccountProviderData;
  }
}
