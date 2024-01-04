import { createHiveChain, IWaxOptionsChain, TWaxExtended } from "@hive-staging/wax/node";

export const WaxExtendTypes = {};

export const getWax = async(options?: Partial<IWaxOptionsChain>): Promise<TWaxExtended<typeof WaxExtendTypes>> => {
  const wax = await createHiveChain(options);

  return wax.extend(WaxExtendTypes);
};
