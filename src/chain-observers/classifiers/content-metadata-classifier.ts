import type { asset, beneficiary_route_type, TAccountName } from "@hiveio/wax";
import Long from "long";
import { CollectorClassifierBase } from "./collector-classifier-base";

export interface IHiveContentMetadata {
  /**
   * The main topic or community tag for this content.
   * @example "hive-106130"
   */
  category: string;

  /**
   * The author of the content, usually a Hive account name.
   * @example "sagarkothari88"
   */
  author: TAccountName;

  /**
   * The unique identifier for this content, often called a "permlink."
   * @example "mentorship-onboarding-and-how-to-create-an-ezabay-account-for-easily-conversion"
   */
  permlink: string;

  /**
   * The title of the content. This is usually present for posts, but might be empty for comments.
   * @example "Mentorship, onboarding and how to create an Ezabay account for easily conversion."
   */
  title?: string;

  /**
   * The date and time when the content was originally created.
   */
  created: Date;

  /**
   * The date and time when the content was last edited.
   */
  lastUpdated: Date;

  /**
   * If this content is a reply, this is the author of the content it replies to.
   * Will be empty if it's a top-level post.
   * @example ""
   */
  parentAuthor: string;

  /**
   * If this content is a reply, this is the unique identifier (permlink) of the content it replies to.
   * Will be the category if it's a reply to the main category feed.
   * @example "hive-106130"
   */
  parentPermlink: string;

  /**
   * The number of direct replies this content has received.
   * @example 3
   */
  replyCount: number;

  /**
   * Indicates how "deep" this content is in a conversation thread.
   * 0 means it's a top-level post. 1 means it's a direct reply to a post, 2 is a reply to a reply, and so on.
   * @example 0
   */
  depth: number;

  /**
   * This is a crucial number representing the total "Reward Shares" accumulated by this content from upvotes.
   * Think of it as the post's "vote weight" or "reward influence." The higher this number,
   * the greater its potential share of the Hive reward pool. It's not a direct dollar amount
   * but an internal blockchain measure. The final payout is calculated based on this value
   * relative to other content paying out at the same time.
   * @example 150255792948762
   */
  netRshares: Long;

  /**
   * The total number of individual upvotes this content has received.
   * While `netRshares` is more directly tied to rewards (as some votes carry more weight than others),
   * this shows the raw count of votes.
   * @example 245
   */
  netVotes: number;

  /**
   * The date and time when the rewards for this content are scheduled to be distributed.
   * This is typically 7 days after the content was created.
   * Set to "1970-01-01T00:00:00Z" if the content is still pending.
   * @example "2025-05-28T23:47:06"
   */
  payoutTime: Date;

  /**
   * Indicates if the content has already paid out rewards.
   * This will be `true` if the `payoutTime` is in the past, meaning rewards have been distributed.
   * If the `payoutTime` is in the future, this will be `false`.
   * @example true
   */
  isPaid: boolean;

  /**
   * The total value (usually in Hive Backed Dollars - HBD) that was actually paid out for this content.
   * This will show "0" or be empty if the `payoutTime` is still in the future.
   * The `amount` is the numerical value, `nai` is the asset identifier, and `precision` is the number of decimal places.
   * @example { "amount": "0", "nai": "@@000000013", "precision": 3 }
   */
  totalPayoutValue: asset;

  /**
   * The portion of the `totalPayoutValue` that was distributed to "curators" (people who upvoted the content).
   * This will also show "0" or be empty if the `payoutTime` is in the future.
   * @example { "amount": "0", "nai": "@@000000013", "precision": 3 }
   */
  curatorPayoutValue: asset;

  /**
   * A list of other Hive accounts that will receive a percentage of this content's rewards.
   * `account` is the username of the beneficiary.
   * `weight` represents their share (e.g., 100 means 1%, 1000 means 10%).
   * @example [{ account: "sagarkothari88", weight: 100 }, { account: "spk.beneficiary", weight: 1000 }]
   */
  beneficiaries: Array<beneficiary_route_type>;

  /**
   * Indicates if other users are allowed to reply to this content.
   * @example true
   */
  allowsReplies: boolean;

  /**
   * Indicates if other users are allowed to vote on this content.
   * @example true
   */
  allowsVotes: boolean;

  /**
   * Indicates if users who upvote this content are eligible to earn curation rewards.
   * @example true
   */
  allowsCurationRewards: boolean;

  /**
   * The amount of rewards, in Hive Power, that the author received after the payout.
   * This will be 0 if the post hasn't paid out yet.
   * @example 0
   */
  authorRewards: Long;
}

export type TContentMetadataAuthorData = Record<string, IHiveContentMetadata>;

export interface IContentData {
  contentData: Record<TAccountName, TContentMetadataAuthorData>;
}

export type TContentMetadataQueryData = [TAccountName, string];

export type TContentMetadataQueryOptions = {
  requestedData: TContentMetadataQueryData[];
  /**
   * Set this option if you want to report the data after at least 6 seconds before the payout time, provide `6000` (6 seconds in milliseconds).
   * This way, you can be notified e.g. 4 seconds before the actual payout.
   */
  reportAfterMsBeforePayout?: number;
};

export class ContentMetadataClassifier extends CollectorClassifierBase<IContentData, IContentData, TContentMetadataQueryOptions> {}
