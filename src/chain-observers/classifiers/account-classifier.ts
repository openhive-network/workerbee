import type { asset } from "@hiveio/wax";
import { CollectorClassifierBase } from "./collector-classifier-base";

export interface IHiveAssetDetailedBalance {
  liquid: asset;
  unclaimed: asset;
  total: asset;
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
  postingJsonMetadata: Record<string, any>;
  jsonMetadata: Record<string, any>;
  balance: IAccountBalance;
}

export interface IAccountData {
  accounts: Record<string, IAccount>;
}

export class AccountClassifier extends CollectorClassifierBase {
  public type!: IAccountData;
}
