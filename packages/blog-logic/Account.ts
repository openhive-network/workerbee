import { IAccount } from "./interfaces";
import { AccountDetails } from "./wax";

export class Account implements IAccount {
  public readonly name: string;
  public readonly creationDate: Date;
  public readonly postCount: number;
  public readonly lastActivity: Date;
  public readonly registeredDate: Date;
  public readonly description: string;
  public readonly avatar: string;

  public constructor(accountData: AccountDetails) {
    this.name = accountData.name;
    this.avatar = JSON.parse(accountData.posting_json_metadata)?.profile.profile_image || "";
    this.creationDate = new Date(accountData.created);
    this.postCount = 0; // In this API not available.
    this.lastActivity = new Date(); // In this API not available.
    this.registeredDate = new Date(accountData.created);
    this.description = JSON.parse(accountData.posting_json_metadata)?.about || "";
  }

  /**
   * Get standard WordPress slug for account.
   */
  public getSlug(): string {
    return this.name;
  }
}
