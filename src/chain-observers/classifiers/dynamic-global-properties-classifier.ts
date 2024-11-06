import { CollectorClassifierBase } from "./collector-classifier-base";

export interface IDynamicGlobalPropertiesData {
  headBlockNumber: number;
  currentWitness: string;
  headBlockTime: Date;
  headBlockId: string;
}

export class DynamicGlobalPropertiesClassifier extends CollectorClassifierBase {
  public type!: IDynamicGlobalPropertiesData;
}
