import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { DataEvaluationContext } from "../factories/data-evaluation-context";

export abstract class ProviderBase<IOptions extends object = {}> {
  public abstract usedContexts(): Array<TRegisterEvaluationContext>;

  public pushOptions?(options: IOptions): void;

  public abstract provide(data: DataEvaluationContext): Promise<any>;
}
