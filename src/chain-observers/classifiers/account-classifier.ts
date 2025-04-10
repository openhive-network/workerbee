import type { asset } from "@hiveio/wax";
import Long from "long";
import { CollectorClassifierBase } from "./collector-classifier-base";

export interface IHiveAssetDetailedBalance {
  liquid: asset;
  unclaimed: asset;
  total: asset;
}

export interface IManabarData {
  currentMana: Long;
  lastUpdateTime: Date;
};

export interface IMaxManabarData extends IManabarData {
  max: Long;
}

export interface IHiveAssetWithSavingsDetailedBalance extends IHiveAssetDetailedBalance {
  savings: asset;
}

export interface IHiveHPAssetDetailedBalance extends IHiveAssetDetailedBalance {
  delegated: asset;
  received: asset;
  poweringDown: asset;
}

export interface IAccountBalance {
  HBD: IHiveAssetWithSavingsDetailedBalance;
  HIVE: IHiveAssetWithSavingsDetailedBalance;
  HP: IHiveHPAssetDetailedBalance;
}

export interface IAccount {
  name: string;
  upvoteManabar: IMaxManabarData;
  downvoteManabar: IManabarData;
  postingJsonMetadata: Record<string, any>;
  jsonMetadata: Record<string, any>;
  balance: IAccountBalance;
  recoveryAccount: string;
  governanceVoteExpiration?: Date;
}

export interface IAccountData {
  accounts: Record<string, IAccount>;
}

export class AccountClassifier extends CollectorClassifierBase {
  public type!: IAccountData;
}
