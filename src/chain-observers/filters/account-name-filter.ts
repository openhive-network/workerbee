import { IAccountData } from "../providers/account.provider";
import type { ProvidersData } from "../providers-mediator";
import { FilterBase } from "./filter-base";

export class AccountNameFilter extends FilterBase {
  public constructor(
    private readonly account: string
  ) {
    super();
  }

  public aggregate() {
    return [
      "accounts"
    ] satisfies Array<keyof ProvidersData>;
  }

  public async match(data: Pick<ProvidersData, ReturnType<AccountNameFilter["aggregate"]>[number]>): Promise<IAccountData | void> {
    const accounts = await data.accounts;

    const account = accounts.getAccount(this.account);

    if (account)
      return account;
  }
}
