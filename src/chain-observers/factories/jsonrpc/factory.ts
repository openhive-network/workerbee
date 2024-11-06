import { WorkerBee } from "../../../bot";
import { FactoryBase } from "../factory-base";
import { JsonRpcFactoryData } from "./factory-data";

export class JsonRpcFactory extends FactoryBase {
  public constructor(
    protected readonly worker: WorkerBee
  ) {
    super(worker);

    this.collectors = new Map(JsonRpcFactoryData(worker));
  }
}
