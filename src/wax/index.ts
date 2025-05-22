import { asset, beneficiary_route_type, createHiveChain, IHiveChainInterface, IWaxOptionsChain, price, TAccountName, TWaxExtended } from "@hiveio/wax";

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
    find_comments: {
      params: { comments: Array<[TAccountName, string]> };
      result: { comments: Array<{
        abs_rshares: 150255792948762,
        allow_curation_rewards: boolean;
        allow_replies: boolean;
        allow_votes: boolean;
        author: TAccountName;
        author_rewards: number;
        beneficiaries: Array<beneficiary_route_type>;
        body: string;
        cashout_time: string;
        category: string
        children: number;
        children_abs_rshares: number;
        created: string;
        curator_payout_value: asset;
        depth: number;
        id: number;
        json_metadata: string;
        last_payout: string;
        last_update: string;
        max_accepted_payout: asset;
        max_cashout_time: string;
        net_rshares: number | string;
        net_votes: number;
        parent_author: string
        parent_permlink: string;
        percent_hbd: number;
        permlink: string;
        reward_weight: string;
        root_author: TAccountName;
        root_permlink: string;
        title: string;
        total_payout_value: asset;
        total_vote_weight: number | string;
        vote_rshares: number | string;
      }>; };
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

export const getWax = async(explicitHiveChain?: IHiveChainInterface, options?: Partial<IWaxOptionsChain>): Promise<TWaxExtended<WaxExtendTypes>> => {

  if(explicitHiveChain === undefined)
    explicitHiveChain = await createHiveChain(options);

  return explicitHiveChain.extend<WaxExtendTypes>();
};
