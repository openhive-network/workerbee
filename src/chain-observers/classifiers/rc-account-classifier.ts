import { IMaxManabarData } from "./account-classifier";
import { CollectorClassifierBase } from "./collector-classifier-base";

export interface IRcAccount {
  name: string;
  rcManabar: IMaxManabarData;
}

export interface IRcAccountData {
  rcAccounts: Record<string, IRcAccount>;
}

export interface IRcAccountCollectorOptions {
  rcAccount: string;
}

export class RcAccountClassifier extends CollectorClassifierBase<IRcAccountData, void, void, IRcAccountCollectorOptions> {
  public static forOptions(options: IRcAccountCollectorOptions) {
    return {
      class: this, // Intentionally using `this` to refer to the class prototype itself later - even though it is not a class **instance**
      options
    };
  }
}
