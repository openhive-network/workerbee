import { ApiAccount } from "@hiveio/wax";
import { DataCollectorBase } from "./collector-base";

const MAX_ACCOUNTS_PER_REQUEST = 100;

export class AccountCollector extends DataCollectorBase {
  private accountsToParse: Record<string, number> = {};

  public pushOptions(data: { account: string }) {
    this.accountsToParse[data.account] = (this.accountsToParse[data.account] ?? 0) + 1;
  }
  public popOptions(data: { account: string }) {
    if(0 === (this.accountsToParse[data.account] = this.accountsToParse[data.account] - 1))
      delete this.accountsToParse[data.account];
  }

  public async fetchData(): Promise<ApiAccount[]> {
    const result: ApiAccount[] = [];

    const accountNames = Object.keys(this.accountsToParse);

    if (accountNames.length === 0)
      return result;

    for (let i = 0; i < accountNames.length; i += MAX_ACCOUNTS_PER_REQUEST) {
      const { accounts } = await this.mediator.chain.api.database_api.find_accounts({ accounts: accountNames.slice(i, i + MAX_ACCOUNTS_PER_REQUEST) });

      result.push(...accounts);
    }

    return result;
  }
}
