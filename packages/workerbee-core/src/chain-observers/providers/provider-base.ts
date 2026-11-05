import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { TProviderEvaluationContext } from "../factories/data-evaluation-context";

export interface IProviderBase<IOptions extends object = {}> {
  usedContexts?(): Array<TRegisterEvaluationContext>;
  pushOptions?(options: IOptions): void;
  provide(data: TProviderEvaluationContext): Promise<object>; // Return anything that can have properties to be merged for the final result
}

export abstract class ProviderBase<IOptions extends object = {}> implements IProviderBase<IOptions> {
  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [];
  }

  public pushOptions?(options: IOptions): void;

  public abstract provide(data: TProviderEvaluationContext): Promise<object>;
}
