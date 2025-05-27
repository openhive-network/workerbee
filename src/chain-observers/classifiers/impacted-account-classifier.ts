import { CollectorClassifierBase } from "./collector-classifier-base";
import type { IOperationBaseData } from "./operation-classifier";

export interface IImpactedAccount extends IOperationBaseData {
  name: string;
}

export interface IImpactedAccountData {
  impactedAccounts: Record<string, IImpactedAccount>;
}

export class ImpactedAccountClassifier extends CollectorClassifierBase<IImpactedAccountData> {}
