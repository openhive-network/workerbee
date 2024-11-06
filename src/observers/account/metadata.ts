import { ApiAccount } from "@hiveio/wax";
import { BlockObserver } from "../observer-base";

export interface IAccountMetadataObserverOptions {
  account: string;
}

export class AccountMetadataObserver extends BlockObserver<ApiAccount, IAccountMetadataObserverOptions> {
  protected hasChanged(current: ApiAccount, previous?: ApiAccount): boolean {
    const jsonMetadataChange = current.json_metadata !== previous?.json_metadata;
    const postingJsonMetadataChange = current.posting_json_metadata !== previous?.posting_json_metadata;

    return jsonMetadataChange || postingJsonMetadataChange;
  }

  protected async retrieveData(): Promise<ApiAccount> {
    const { accounts: [ account ] } = await this.bot.chain!.api.database_api.find_accounts({ accounts: [this.options.account] });

    return account;
  }
}
