import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { TProviderEvaluationContext } from "../factories/data-evaluation-context";

export abstract class ProviderBase<IOptions extends object = {}> {
  public abstract usedContexts(): Array<TRegisterEvaluationContext>;

  public pushOptions?(options: IOptions): void;

  public abstract provide(data: TProviderEvaluationContext): Promise<any>;
}
