import type { ProvidersData } from "../providers-mediator";

export abstract class FilterBase {
  /**
   * Matches the data againts the current providers state
   *
   * @param data Partial providers data based on the {@link aggregate} return method
   */
  public abstract match(data: Pick<ProvidersData, ReturnType<FilterBase['aggregate']>[number]>): Promise<any>;

  /**
   * Specifies which providers will be requried for this filter
   */
  public abstract aggregate(): Array<keyof ProvidersData>;
}
