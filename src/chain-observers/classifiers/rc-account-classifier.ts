import { IMaxManabarData } from "./account-classifier";
import { CollectorClassifierBase } from "./collector-classifier-base";

export interface IRcAccount {
  name: string;
  rcManabar: IMaxManabarData;
}

export interface IRcAccountData {
  rcAccounts: Record<string, IRcAccount>;
}

export class RcAccountClassifier extends CollectorClassifierBase<IRcAccountData> {

}
