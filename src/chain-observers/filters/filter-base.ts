import type { WorkerBee } from "../../bot";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { DataEvaluationContext } from "../factories/data-evaluation-context";

export abstract class FilterBase {
  public constructor(
    protected readonly worker: WorkerBee
  ) {}

  public abstract usedContexts(): Array<TRegisterEvaluationContext>;

  public abstract match(data: DataEvaluationContext): Promise<boolean>;
}
