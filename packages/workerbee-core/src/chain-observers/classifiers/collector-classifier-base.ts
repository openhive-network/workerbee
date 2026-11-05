export interface IEvaluationContextClass<
  T extends CollectorClassifierBase<any, any, any, any, any> = CollectorClassifierBase<any, any, any, any, any>
> {
  name: string;

  new(): T;
}

export type TRegisterEvaluationContext = IEvaluationContextClass | {
  options?: Record<string, any>;
  class: IEvaluationContextClass;
}

export class CollectorClassifierBase<
  TStore extends Record<string, any> = {},
  TGetResult extends void | Record<string, any> = void,
  TQueryResult extends void | Record<string, any> = void,
  TQueryOptions extends void | Record<string, any> = void,
  TOptions extends undefined | Record<string, any> = undefined
> {
  /*
   * Virtual members - visible only on TypeScript level, not at runtime
   * These members are used to define the type of the collector classifier
   * and to ensure that the collector classifier is used correctly in the evaluation context
   */
  public getType!: TGetResult;
  public queryType!: TQueryResult;
  public queryOptionsType!: TQueryOptions;
  public optionsType!: TOptions;
  public storeType!: TStore;
}
