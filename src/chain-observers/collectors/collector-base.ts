import type { WorkerBee } from "../../bot";

import type * as TClassifiers from "../classifiers";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { DataEvaluationContext } from "../factories/data-evaluation-context";

export type TAvailableClassifiers = {
  [key in keyof typeof TClassifiers]: InstanceType<(typeof TClassifiers)[key]>["type"];
};

export class CollectorBase {
  public constructor(
    protected readonly worker: WorkerBee
  ) {}

  private registersCount = 0;

  /**
   * We need to return the data in the format of { [classifierName]: { [key]: value } } so
   * overriding can be properly deduced later by the data evaluation context
   *
   * This method allows to get collector state and cache the request, which can be used in the evaluation context {@link DataEvaluationContext.get} method
   * Think of this method as HTTP GET request, while {@link CollectorBase.query} is like HTTP POST request
   *
   * When user calls this method via Data evaluation context, and it is not overridden by the subclass, it will fail with an error
   */
  public get?(data: DataEvaluationContext): Promise<Partial<TAvailableClassifiers>>;

  /**
   * We need to return the data in the format of { [classifierName]: { [key]: value } } so
   * overriding can be properly deduced later by the data evaluation context
   *
   * This method allows to query the collector for data (without cache), which can be used in the evaluation context {@link DataEvaluationContext.query} method
   * Think of this method as HTTP POST request, while {@link CollectorBase.get} is like HTTP GET request
   *
   * When user calls this method via Data evaluation context, and it is not overridden by the subclass, it will fail with an error
   */
  public query?(data: DataEvaluationContext, options: object): Promise<Partial<TAvailableClassifiers>>;

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
