import { ProvidersData } from "src/chain-observers/providers-mediator";
import { ObserverBase } from "../observer-base";

export interface IAccountMetadata {
  jsonMetadata: string;
  postingJsonMetadata: string;
}

export class AccountMetadataObserver extends ObserverBase<IAccountMetadata> {
  protected hasChanged(current: IAccountMetadata, previous?: IAccountMetadata): boolean {
    const jsonMetadataChange = current.jsonMetadata !== previous?.jsonMetadata;
    const postingJsonMetadataChange = current.postingJsonMetadata !== previous?.postingJsonMetadata;

    return jsonMetadataChange || postingJsonMetadataChange;
  }

  protected async retrieveData(dataProvider: ProvidersData): Promise<IAccountMetadata | undefined> {
    const accounts = await dataProvider.accounts;

    const accountMetadata = accounts.getAccount(this.options.account!);

    if (accountMetadata === undefined)
      return;

    return {
      jsonMetadata: accountMetadata.jsonMetadata,
      postingJsonMetadata: accountMetadata.postingJsonMetadata
    };
  }
}
