import { CollectorsData } from "../providers-mediator";
import { ObserversRegistry } from "../registry";

export abstract class DataProviderBase {
  public abstract parseData(data: CollectorsData): Promise<any>;
}
