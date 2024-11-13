import { CollectorsData } from "../providers-mediator";
import { DataProviderBase } from "./provider-base";

export interface IAccountData {
  jsonMetadata: string;
  postingJsonMetadata: string;
}

export class AccountProvider extends DataProviderBase {
  private accounts: Map<string, IAccountData> = new Map();

  public getAccount(name: string): IAccountData | undefined {
    return this.accounts.get(name);
  }

  public async parseData(data: CollectorsData): Promise<Omit<this, keyof DataProviderBase>> {
    const accounts = await data.accounts;

    this.accounts = new Map(accounts.map(account => ([account.name, {
      jsonMetadata: account.json_metadata,
      postingJsonMetadata: account.posting_json_metadata
    }])));

    return this;
  }
}
