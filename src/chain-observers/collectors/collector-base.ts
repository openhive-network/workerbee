import type { WorkerBee } from "../../bot";

import type * as TClassifiers from "../classifiers";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { DataEvaluationContext } from "../factories/data-evaluation-context";

export type TAvailableClassifiers = {
  [key in keyof typeof TClassifiers]: InstanceType<(typeof TClassifiers)[key]>["type"];
};

export abstract class CollectorBase {
  public constructor(
    protected readonly worker: WorkerBee
  ) {}

  private registersCount = 0;

  /*
   * We need to return the data in the format of { [classifierName]: { [key]: value } } so
   * overriding can be properly deduced later by the data evaluation context
   */
  public abstract fetchData(data: DataEvaluationContext): Promise<Partial<TAvailableClassifiers>>;

  /**
   * If the collector uses any context, it should report it as dependency by overriding this function
   */
  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [];
  }

  protected pushOptions?(data: Record<string, any>): void;
  protected popOptions?(data: Record<string, any>): void;

  public get hasRegistered() {
    return this.registersCount > 0;
  }

  public register(data?: Record<string, any>) {
    ++this.registersCount;

    if (data !== undefined)
      this.pushOptions?.(data);
  }
  public unregister(data?: Record<string, any>) {
    --this.registersCount;

    if (data !== undefined)
      this.popOptions?.(data);
  }
}
