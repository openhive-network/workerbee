import { TPublicKey } from "@hiveio/beekeeper";
import { authority, TAccountName } from "@hiveio/wax";
import { WorkerBeeIterable } from "../../types/iterator";
import { OperationClassifier } from "../classifiers";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { TProviderEvaluationContext } from "../factories/data-evaluation-context";
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

  public async provide(data: TProviderEvaluationContext): Promise<INewAccountProviderData> {
    const result: TNewAccountProvided[] = [];

    const { operationsPerType } = await data.get(OperationClassifier);

    const operations = [
      ...(operationsPerType.create_claimed_account_operation ?? []),
      ...(operationsPerType.account_create_operation ?? []),
      ...(operationsPerType.account_create_with_delegation_operation ?? [])
    ];

    for(const { operation } of operations) {
      let jsonMetadata: Record<string, unknown> = {};
      if (operation.json_metadata)
        try {
          jsonMetadata = JSON.parse(operation.json_metadata);
        // eslint-disable-next-line no-empty
        } catch {}

      result.push({
        accountName: operation.new_account_name,
        active: operation.active!,
        creator: operation.creator,
        jsonMetadata,
        memo: operation.memo_key,
        owner: operation.owner!,
        posting: operation.posting!,
      });
    }

    return {
      newAccounts: new WorkerBeeIterable(result)
    } as INewAccountProviderData;
  }
}
