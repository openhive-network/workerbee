import { CollectorClassifierBase } from "./collector-classifier-base";

export interface IWitness {
  owner: string;
  runningVersion: string;
  totalMissedBlocks: number;
  lastConfirmedBlockNum: number;
}

export interface IWitnessData {
  witnesses: Record<string, IWitness>;
}

export interface IWitnessCollectorOptions {
  witness: string;
}

export class WitnessClassifier extends CollectorClassifierBase<IWitnessData, void, void, IWitnessCollectorOptions> {
  public static forOptions(options: IWitnessCollectorOptions) {
    return {
      class: this, // Intentionally using `this` to refer to the class prototype itself later - even though it is not a class **instance**
      options
    };
  }
}
