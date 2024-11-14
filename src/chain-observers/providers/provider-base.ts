import { CollectorsData, ProvidersMediator } from "../providers-mediator";

export abstract class DataProviderBase {
  public constructor(
    protected readonly mediator: ProvidersMediator
  ) {}

  public abstract parseData(data: CollectorsData): Promise<any>;
}
