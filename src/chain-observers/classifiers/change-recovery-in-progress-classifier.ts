import { CollectorClassifierBase, TRegisterEvaluationContext } from "./collector-classifier-base";

export interface IAccountChangingRecovery {
  accountToRecover: string;
  recoveryAccount: string;
  effectiveOn: Date;
}

export interface IChangeRecoveryInProgressData {
  recoveringAccounts: Record<string, IAccountChangingRecovery>;
}

export interface IChangeRecoveryCollectorOptions {
  changeRecoveryAccount: string;
}

export class ChangeRecoveryInProgressClassifier extends CollectorClassifierBase<
  {},
  IChangeRecoveryInProgressData,
  void,
  void,
  IChangeRecoveryCollectorOptions
> {
  public static forOptions(options: IChangeRecoveryCollectorOptions): TRegisterEvaluationContext {
    return {
      class: this, // Intentionally using `this` to refer to the class prototype itself later - even though it is not a class **instance**
      options
    };
  }
}
