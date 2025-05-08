import { CollectorClassifierBase } from "./collector-classifier-base";

export interface IAccountChangingRecovery {
  accountToRecover: string;
  recoveryAccount: string;
  effectiveOn: Date;
}

export interface IChangeRecoveryInProgressData {
  recoveringAccounts: Record<string, IAccountChangingRecovery>;
}

export class ChangeRecoveryInProgressClassifier extends CollectorClassifierBase<IChangeRecoveryInProgressData> {

}
