import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { DataEvaluationContext } from "../factories/data-evaluation-context";

export abstract class ProviderBase {
  public abstract usedContexts(): Array<TRegisterEvaluationContext>;

  public abstract provide(data: DataEvaluationContext): Promise<any>;
}
