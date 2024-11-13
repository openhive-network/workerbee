import { ObserversRegistry } from "../registry";

export abstract class DataCollectorBase {
  protected registry = ObserversRegistry.getInstance();

  public pushOptions(_data: Record<string, any>) {}
  public popOptions(_data: Record<string, any>) {}

  public abstract fetchData(): Promise<any>;
}
