import { createHiveChain, IHiveChainInterface, IWaxOptionsChain, price, TWaxExtended } from "@hiveio/wax";

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
    }
  }
};

export const getWax = async(explicitHiveChain?: IHiveChainInterface, options?: Partial<IWaxOptionsChain>): Promise<TWaxExtended<WaxExtendTypes>> => {

  if(explicitHiveChain === undefined)
    explicitHiveChain = await createHiveChain(options);

  return explicitHiveChain.extend<WaxExtendTypes>();
};
