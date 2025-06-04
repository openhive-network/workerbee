import { createHiveChain, IWaxOptionsChain, price, TWaxExtended } from "@hiveio/wax";

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

export const getWax = async(options?: Partial<IWaxOptionsChain>): Promise<TWaxExtended<WaxExtendTypes>> => {
  return (await createHiveChain(options)).extend<WaxExtendTypes>();
};
