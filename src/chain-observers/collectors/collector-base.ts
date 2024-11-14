import type { ProvidersMediator } from "../providers-mediator";

export abstract class DataCollectorBase {
  public constructor(
    protected readonly mediator: ProvidersMediator
  ) {}

  public pushOptions(_data: Record<string, any>) {}
  public popOptions(_data: Record<string, any>) {}

  public abstract fetchData(): Promise<any>;
}
