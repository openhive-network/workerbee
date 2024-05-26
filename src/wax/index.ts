import { createHiveChain, IHiveChainInterface, IWaxOptionsChain, TWaxExtended } from "@hiveio/wax";

export const WaxExtendTypes = {};

export const getWax = async (explicitHiveChain?: IHiveChainInterface, options?: Partial<IWaxOptionsChain>): Promise<TWaxExtended<typeof WaxExtendTypes>> => {

  if(explicitHiveChain === undefined)
    explicitHiveChain = await createHiveChain(options);

  return explicitHiveChain.extend(WaxExtendTypes);
};
