import type { ApiAccount } from "@hiveio/wax";
import { ObserverBase } from "../observer-base";
import { IDataProviderOptionsForAccount, TDataProviderForOptions } from "../register";

export interface IAccountMetadataObserverOptions extends IDataProviderOptionsForAccount {}

export class AccountMetadataObserver extends ObserverBase<ApiAccount, IAccountMetadataObserverOptions> {
  protected hasChanged(current: ApiAccount, previous?: ApiAccount): boolean {
    const jsonMetadataChange = current.json_metadata !== previous?.json_metadata;
    const postingJsonMetadataChange = current.posting_json_metadata !== previous?.posting_json_metadata;

    return jsonMetadataChange || postingJsonMetadataChange;
  }

  protected retrieveData(dataProvider: TDataProviderForOptions<IAccountMetadataObserverOptions>): ApiAccount {
    return dataProvider.account;
  }
}
