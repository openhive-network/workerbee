import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { TProviderEvaluationContext } from "../factories/data-evaluation-context";

export abstract class ProviderBase<IOptions extends object = {}, Structure extends object = {}> {
  public abstract usedContexts(): Array<TRegisterEvaluationContext>;

  public pushOptions?(options: IOptions): void;

  public abstract provide(data: TProviderEvaluationContext): Promise<any>;

  /**
   * The base structure of the data provided by this provider.
   *
   * This can be used for type checking and ensuring that the data provided by the provider adheres to a specific structure.
   * This is also called as a fallback when no data is provided by the provider, e.g. due to an error.
   *
   * Note: This is intentionally a getter to avoid issues with shared state between multiple #provide calls
   */
  public abstract get baseStructure(): Structure;
}
