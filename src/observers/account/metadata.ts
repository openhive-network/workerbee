import type { ApiAccount } from "@hiveio/wax";
import { ObserverBase, TDataFromEvents } from "../observer-base";

export interface IAccountMetadataObserverOptions {
  account: string;
}

export class AccountMetadataObserver extends ObserverBase<ApiAccount, AccountMetadataObserver, IAccountMetadataObserverOptions> {
  public readonly listenForAccount = true;

  protected hasChanged(current: ApiAccount, previous?: ApiAccount): boolean {
    const jsonMetadataChange = current.json_metadata !== previous?.json_metadata;
    const postingJsonMetadataChange = current.posting_json_metadata !== previous?.posting_json_metadata;

    return jsonMetadataChange || postingJsonMetadataChange;
  }

  protected retrieveData(metadata: TDataFromEvents<AccountMetadataObserver>): ApiAccount {
    return metadata.account.account;
  }
}
