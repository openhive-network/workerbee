import type { ProvidersData } from "../providers-mediator";

export abstract class FilterBase {
  public abstract parse(data: ProvidersData): Promise<void>;
}
