import { IManabarData } from "./account-classifier";
import { CollectorClassifierBase } from "./collector-classifier-base";

export interface IRcAccount {
  name: string;
  rcManabar: IManabarData;
}

export interface IRcAccountData {
  rcAccounts: Record<string, IRcAccount>;
}

export class RcAccountClassifier extends CollectorClassifierBase {
  public type!: IRcAccountData;
}
