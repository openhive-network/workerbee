import type { asset } from "@hiveio/wax";

export const isGreaterThan = (base: asset, other: asset): boolean => {
  return other.amount > base.amount && other.nai === base.nai;
};
