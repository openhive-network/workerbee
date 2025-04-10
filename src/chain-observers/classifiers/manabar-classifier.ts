import { EManabarType } from "@hiveio/wax";
import { IMaxManabarData } from "./account-classifier";
import { CollectorClassifierBase } from "./collector-classifier-base";

export interface IManabarDataPercent extends IMaxManabarData {
  percent: number;
}

export type TManabars = Partial<Record<EManabarType, IManabarDataPercent>>;

export interface IManabarAccountData {
  manabarData: Record<string, TManabars>;
}

export class ManabarClassifier extends CollectorClassifierBase {
  public type!: IManabarAccountData;
}
