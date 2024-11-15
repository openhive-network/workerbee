import { CollectorsData, ProvidersMediator } from "../providers-mediator";

export abstract class DataProviderBase {
  public constructor(
    protected readonly mediator: ProvidersMediator
  ) {}

  /**
   * Specifies which collectors will be requried for this provider
   */
  public abstract aggregate(): Array<keyof CollectorsData>;

  public abstract parseData(data: Pick<CollectorsData, ReturnType<DataProviderBase['aggregate']>[number]>): Promise<any>;
}
