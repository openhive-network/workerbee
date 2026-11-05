import { EManabarType, TAccountName } from "@hiveio/wax";
import { IMaxManabarData } from "./account-classifier";
import { CollectorClassifierBase, TRegisterEvaluationContext } from "./collector-classifier-base";

export interface IManabarDataPercent extends IMaxManabarData {
  percent: number;
}

export type TManabars = Partial<Record<EManabarType, IManabarDataPercent>>;

export interface IManabarAccountData {
  manabarData: Record<string, TManabars>;
}

export interface IManabarCollectorOptions {
  account: TAccountName;
  manabarType: EManabarType;
}

export class ManabarClassifier extends CollectorClassifierBase<{}, IManabarAccountData, void, void, IManabarCollectorOptions> {
  public static forOptions(options: IManabarCollectorOptions): TRegisterEvaluationContext {
    return {
      class: this, // Intentionally using `this` to refer to the class prototype itself later - even though it is not a class **instance**
      options
    };
  }
}
