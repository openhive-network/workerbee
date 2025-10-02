import { CollectorClassifierBase } from "./collector-classifier-base";

export interface IDynamicGlobalPropertiesData {
  headBlockNumber: number;
  currentWitness: string;
  headBlockTime: Date;
  headBlockId: string;
  downvotePoolPercent: number;
}

export class DynamicGlobalPropertiesClassifier extends CollectorClassifierBase<{}, IDynamicGlobalPropertiesData> {}
