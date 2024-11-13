import { CollectorsData } from "../providers-mediator";
import { ObserversRegistry } from "../registry";

export abstract class DataProviderBase {
  protected registry = ObserversRegistry.getInstance();

  public abstract parseData(data: CollectorsData): Promise<any>;
}
