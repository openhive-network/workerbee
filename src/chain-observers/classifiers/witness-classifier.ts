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

export class WitnessClassifier extends CollectorClassifierBase<IWitnessData> {

}
