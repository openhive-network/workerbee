import { CollectorsData } from "../providers-mediator";
import { DataProviderBase } from "./provider-base";

export class BlockProvider extends DataProviderBase {
  public witness!: string;

  public number!: number;

  public blockId!: string;

  public timestamp!: Date;

  public async parseData(data: CollectorsData): Promise<Omit<this, keyof DataProviderBase>> {
    const { number, block: { block_id, timestamp, witness } } = await data.block;

    this.witness = witness;
    this.number = number;

    this.blockId = block_id;
    this.timestamp = new Date(`${timestamp}Z`);

    return this;
  }
}
