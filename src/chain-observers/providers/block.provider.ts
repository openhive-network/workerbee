import { CollectorsData } from "../providers-mediator";
import { DataProviderBase } from "./provider-base";

export class BlockProvider extends DataProviderBase {
  public witness!: string;

  public number!: number;

  public blockId!: string;

  public timestamp!: Date;

  public aggregate() {
    return [
      "block"
    ] satisfies Array<keyof CollectorsData>;
  }

  public async parseData(data: Pick<CollectorsData, ReturnType<BlockProvider['aggregate']>[number]>): Promise<Omit<this, keyof DataProviderBase>> {
    const { number, block: { block_id, timestamp, witness } } = await data.block;

    this.witness = witness;
    this.number = number;

    this.blockId = block_id;
    this.timestamp = new Date(`${timestamp}Z`);

    return this;
  }
}
