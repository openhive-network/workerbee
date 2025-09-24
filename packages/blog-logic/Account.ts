import { IAccount } from "./interfaces";
import { FullAccount } from "./wax";

export class Account implements IAccount {
  public readonly name: string;
  public readonly creationDate: Date;
  public readonly postCount: number;
  public readonly lastActivity: Date;
  public readonly registeredDate: Date;
  public readonly description: string;
  public readonly avatar: string;

  public constructor(accountData: FullAccount) {
    this.name = accountData.name;
    this.avatar = JSON.parse(accountData.posting_json_metadata)?.profile.profile_image || "";
    this.creationDate = new Date(accountData.created);
    this.postCount = accountData.post_count;
    this.lastActivity = new Date(accountData.last_post);
    this.registeredDate = new Date(accountData.created);
    this.description = accountData.profile?.about || "";
  }

  /**
   * Get standard WordPress slug for account.
   */
  public getSlug(): string {
    return this.name;
  }
}
