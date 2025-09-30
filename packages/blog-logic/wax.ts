import {
  createHiveChain,
  TWaxExtended,
  TWaxApiRequest,
  ApiAuthority,
  NaiAsset,
  TWaxRestExtended
} from "@hiveio/wax";

export interface AccountProfile {
  about?: string;
  cover_image?: string;
  location?: string;
  blacklist_description?: string;
  muted_list_description?: string;
  name?: string;
  profile_image?: string;
  website?: string;
  pinned?: string;
  witness_description?: string;
  witness_owner?: string;
}
export interface AccountFollowStats {
  follower_count: number;
  following_count: number;
  account: string;
}

export interface FullAccount {
  vesting_balance: string | NaiAsset;
  name: string;
  owner: ApiAuthority;
  active: ApiAuthority;
  posting: ApiAuthority;
  memo_key: string;
  post_count: number;
  created: string;
  reputation: string | number;
  json_metadata: string;
  posting_json_metadata: string;
  last_vote_time: string;
  last_post: string;
  reward_hbd_balance: string;
  reward_vesting_hive: string;
  reward_hive_balance: string;
  reward_vesting_balance: string;
  governance_vote_expiration_ts: string;
  balance: string;
  vesting_shares: string;
  hbd_balance: string;
  savings_balance: string;
  savings_hbd_balance: string;
  savings_hbd_seconds: string;
  savings_hbd_last_interest_payment: string;
  savings_hbd_seconds_last_update: string;
  next_vesting_withdrawal: string;
  delegated_vesting_shares: string;
  received_vesting_shares: string;
  vesting_withdraw_rate: string;
  to_withdraw: number;
  withdrawn: number;
  witness_votes: string[];
  proxy: string;
  proxied_vsf_votes: number[] | string[];
  voting_manabar: {
    current_mana: string | number;
    last_update_time: number;
  };
  voting_power: number;
  downvote_manabar: {
    current_mana: string | number;
    last_update_time: number;
  };
  profile?: AccountProfile;
  follow_stats?: AccountFollowStats;
  __loaded?: true;
  proxyVotes?: Array<unknown>;
  // Temporary properties for UI purposes
  _temporary?: boolean;
}


export interface IGetPostHeader {
  author: string;
  permlink: string;
  category: string;
  depth: number;
}

export interface JsonMetadata {
  image: string[];
  links?: string[];
  flow?: {
    pictures: {
      caption: string;
      id: number;
      mime: string;
      name: string;
      tags: string[];
      url: string;
    }[];
    tags: string[];
  };
  images: string[];
  author: string | undefined;
  tags?: string[];
  description?: string | null;
  app?: string;
  canonical_url?: string;
  format?: string;
  original_author?: string;
  original_permlink?: string;
  summary?: string;
}

export interface EntryVote {
  voter: string;
  rshares: number;
}

export interface EntryBeneficiaryRoute {
  account: string;
  weight: number;
}

export interface EntryStat {
  flag_weight: number;
  gray: boolean;
  hide: boolean;
  total_votes: number;
  is_pinned?: boolean;
}


export interface Entry {
  active_votes: EntryVote[];
  author: string;
  author_payout_value: string;
  author_reputation: number;
  author_role?: string;
  author_title?: string;
  beneficiaries: EntryBeneficiaryRoute[];
  blacklists: string[];
  body: string;
  category: string;
  children: number;
  community?: string;
  community_title?: string;
  created: string;
  total_votes?: number;
  curator_payout_value: string;
  depth: number;
  is_paidout: boolean;
  json_metadata: JsonMetadata;
  max_accepted_payout: string;
  net_rshares: number;
  parent_author?: string;
  parent_permlink?: string;
  payout: number;
  payout_at: string;
  pending_payout_value: string;
  percent_hbd: number;
  permlink: string;
  post_id: number;
  id?: number;
  promoted: string;
  reblogged_by?: string[];
  replies: Array<unknown>;
  stats?: EntryStat;
  title: string;
  updated: string;
  url: string;
  original_entry?: Entry;
}

export interface VoteData {
  percent: number;
  reputation: number;
  rshares: number;
  time: string;
  timestamp?: number;
  voter: string;
  weight: number;
  reward?: number;
}

export interface CommunityData {
  about: string;
  admins?: string[];
  avatar_url: string;
  created_at: string;
  description: string;
  flag_text: string;
  id: number;
  is_nsfw: boolean;
  lang: string;
  name: string;
  num_authors: number;
  num_pending: number;
  subscribers: number;
  sum_pending: number;
  settings?: object;
  team: string[][];
  title: string;
  type_id: number;
  context: {
    role: string;
    subscribed: boolean;
    title: string;
    _temporary?: boolean;
  };
  _temporary?: boolean;
}

export interface IVoteListItem {
  id: number;
  voter: string;
  author: string;
  permlink: string;
  weight: string;
  rshares: number;
  vote_percent: number;
  last_update: string;
  num_changes: number;
}

export interface AccountDetails {
  id: number;
  name: string;
  can_vote: boolean;
  mined: boolean;
  proxy: string;
  recovery_account: string;
  last_account_recovery: Date;
  created: Date;
  reputation: number;
  json_metadata: string;
  posting_json_metadata: string;
  profile_image: string;
  hbd_balance: number;
  balance: number;
  vesting_shares: string;
  vesting_balance: number;
  hbd_saving_balance: number;
  savings_balance: number;
  savings_withdraw_requests: number;
  reward_hbd_balance: number;
  reward_hive_balance: number;
  reward_vesting_balance: string;
  reward_vesting_hive: number;
  posting_rewards: string;
  curation_rewards: string;
  delegated_vesting_shares: string;
  received_vesting_shares: string;
  proxied_vsf_votes: number[] | string[];
  withdrawn: string;
  vesting_withdraw_rate: string;
  to_withdraw: string;
  withdraw_routes: number;
  delayed_vests: string;
  witness_votes: string[];
  witnesses_voted_for: number;
  ops_count: number;
  is_witness: boolean;
  governanceTs: any;
}

export type ExtendedNodeApi = {
  bridge: {
    get_post_header: TWaxApiRequest<{ author: string; permlink: string }, IGetPostHeader>;
    get_post: TWaxApiRequest<{ author: string; permlink: string; observer: string }, Entry | null>;
    get_discussion: TWaxApiRequest<
      { author: string; permlink: string; observer?: string },
      Record<string, Entry> | null
    >;
    get_ranked_posts: TWaxApiRequest<
      {
        sort: string;
        tag: string;
        start_author: string;
        start_permlink: string;
        limit: number;
        observer: string;
      },
      Entry[] | null
    >;
    get_account_posts: TWaxApiRequest<
      {
        sort: string;
        account: string;
        start_author: string;
        start_permlink: string;
        limit: number;
        observer: string;
      },
      Entry[] | null
    >;
    list_communities: TWaxApiRequest<
    { sort: string; query?: string | null; observer: string },
    CommunityData[] | null
  >;
  };
  database_api: {
    list_votes: TWaxApiRequest<
      {
        start: [string, string, string] | null;
        limit: number;
        order: "by_comment_voter" | "by_voter_comment";
      },
      { votes: IVoteListItem[] }
    >;
  }
};

export type ExtendedRestApi = {
  "hafbe-api": {
    accounts: {
      account: {
        params: { accountName: string };
        result: AccountDetails,
        urlPath: "{accountName}",
      },
  }
  }
};

let chain: Promise<TWaxExtended<ExtendedNodeApi, TWaxRestExtended<ExtendedRestApi>>>;

export const getWax = () => {
  if (!chain)
    return chain = createHiveChain().then(chain => chain.extend<ExtendedNodeApi>().extendRest<ExtendedRestApi>({}));

  return chain;
};
