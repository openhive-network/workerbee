import { ICommunity } from "./interfaces";
import { CommunityData } from "./wax";

export class Community implements ICommunity {
  public readonly name: string;
  public readonly title: string;
  public readonly about: string;
  public readonly admins: string[];
  public readonly avatarUrl: string;
  public readonly creationDate: Date;
  public readonly subscribersCount: number;
  public readonly authorsCount: number;
  public readonly pendingCount: number;

  public constructor(communityData: CommunityData) {
    this.name = communityData.name;
    this.title = communityData.title;
    this.about = communityData.about;
    this.admins = communityData.admins || [];
    this.avatarUrl = communityData.avatar_url;
    this.creationDate = new Date(communityData.created_at);
    this.subscribersCount = communityData.subscribers;
    this.authorsCount = communityData.num_authors;
    this.pendingCount = communityData.num_pending;

  }

  /**
   * Get standard WordPress slug. It treats community as category.
   */
  public getSlug(): string {
    return this.title
  }
}
