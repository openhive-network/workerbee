import { CollectorClassifierBase } from "./collector-classifier-base";

export interface IRcAccount {
  name: string;
  manabar: {
    currentMana: string;
    lastUpdateTime: Date;
  };
  maxRc: string;
}

export interface IRcAccountData {
  rcAccounts: Record<string, IRcAccount>;
}

export class RcAccountClassifier extends CollectorClassifierBase {
  public type!: IRcAccountData;
}
