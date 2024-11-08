import { ObserverBase } from "../observer-base";
import type { IAccountMetadata } from "../register/account";
import type { IDataProviderOptionsForAccount, TDataProviderForOptions } from "../register/register";

export interface IAccountMetadataObserverOptions extends IDataProviderOptionsForAccount {}

export class AccountMetadataObserver extends ObserverBase<IAccountMetadata, IAccountMetadataObserverOptions> {
  protected hasChanged(current: IAccountMetadata, previous?: IAccountMetadata): boolean {
    const jsonMetadataChange = current.accountMetadata !== previous?.accountMetadata;
    const postingJsonMetadataChange = current.postingMetadata !== previous?.postingMetadata;

    return jsonMetadataChange || postingJsonMetadataChange;
  }

  protected retrieveData(dataProvider: TDataProviderForOptions<IAccountMetadataObserverOptions>): IAccountMetadata {
    return dataProvider.account.metadata;
  }
}
