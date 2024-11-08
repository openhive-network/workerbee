import type { RcAccount } from "@hiveio/wax";

export class RcAccountDataProvider {
  public constructor(
    private readonly account: RcAccount
  ) {}

  public get name(): string {
    return this.account.account;
  }
}
