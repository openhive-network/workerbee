import { CollectorClassifierBase } from "./collector-classifier-base";

export interface IBlockHeaderData {
  timestamp: Date;
  witness: string;
  number: number;
  id: string;
}

export class BlockHeaderClassifier extends CollectorClassifierBase<{}, IBlockHeaderData> {}
