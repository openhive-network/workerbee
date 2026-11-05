import { asset, price, TAccountName } from "@hiveio/wax";

export type share_type = number | string;
export type time_point_sec = string; // ISO 8601 date string

export type comment_cachout_info = {

  total_payout_value: asset;
  total_vote_weight: number | string;
  curator_payout_value: asset;
  max_accepted_payout: asset;

  author_rewards: share_type;
  children_abs_rshares: share_type;
  net_rshares: share_type;
  abs_rshares: share_type;
  vote_rshares: share_type;

  net_votes: number;

  last_payout: time_point_sec ;
  cashout_time: time_point_sec;
  max_cashout_time: time_point_sec;

  percent_hbd: number;
  reward_weight: number;
  allow_replies: boolean;
  allow_votes: boolean;
  allow_curation_rewards: boolean;
  was_voted_on: boolean;
};

export type comment_pending_payout_info = {
  author: TAccountName;
  permlink: string;
  cashout_info?: comment_cachout_info;
};

export type WaxExtendTypes = {
  database_api: {
    get_feed_history: {
      params: {},
      result: {
        current_median_history: price;
        market_median_history: price;
        current_min_history: price;
        current_max_history: price;
        price_history: price[];
      }
    };
    find_witnesses: {
      params: { owners: string[]; };
      result: { witnesses: Array<{
        owner: string;
        total_missed: number;
        running_version: string;
        last_confirmed_block_num: number;
        // ...
      }>; };
    };
    get_comment_pending_payouts: {
      params: { comments: Array<[TAccountName, string]>; };
      result: { cashout_infos: Array<comment_pending_payout_info>; };
    };
    find_decline_voting_rights_requests: {
      params: { accounts: string[]; };
      result: { requests: Array<{
        account: string;
        effective_date: string;
      }>; };
    };
    find_change_recovery_account_requests: {
      params: { accounts: string[]; };
      result: { requests: Array<{
        account_to_recover: string;
        recovery_account: string;
        effective_on: string;
      }>; };
    };
  }
};
