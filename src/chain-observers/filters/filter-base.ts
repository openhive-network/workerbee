import type { WorkerBee } from "../../bot";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { TFilterEvaluationContext } from "../factories/data-evaluation-context";

export interface IFilterBase {
  usedContexts?(): Array<TRegisterEvaluationContext>;
  match(data: TFilterEvaluationContext): Promise<boolean>;
}

export abstract class FilterBase implements IFilterBase {
  protected readonly worker!: WorkerBee;

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [];
  }

  public abstract match(data: TFilterEvaluationContext): Promise<boolean>;
}
