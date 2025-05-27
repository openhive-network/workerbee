import type { WorkerBee } from "../../bot";

import type * as TClassifiers from "../classifiers";
import { CollectorClassifierBase, TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { DataEvaluationContext } from "../factories/data-evaluation-context";

export type TAvailableClassifiers = {
  [key in keyof typeof TClassifiers]: InstanceType<(typeof TClassifiers)[key]>["getType"];
};

export type TSpecificClassifier<T extends CollectorClassifierBase<any, any, any, any>> =
  // First check if the classifier has a getType method, if not, return an empty object to note that there is no specific classifier selected
  T["getType"] extends void ? {} :
  {
    [K in keyof typeof TClassifiers as InstanceType<(typeof TClassifiers)[K]> extends T ? K : never]: InstanceType<(typeof TClassifiers)[K]>["getType"];
  };

export class CollectorBase<Classifier extends CollectorClassifierBase<any, any, any, any>> {
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
  public get?(data: DataEvaluationContext): Promise<TSpecificClassifier<Classifier> & Partial<TAvailableClassifiers>>;

  /**
   * This method allows to query the collector for data (without cache), which can be used in the evaluation context {@link DataEvaluationContext.query} method
   * Think of this method as HTTP POST request, while {@link CollectorBase.get} is like HTTP GET request
   *
   * Note: As results from this method are not cached, it is expected to be used for real-time data retrieval,
   * such as fetching the latest state of specific posts
   * This means, this method cannot override other classifiers data
   *
   * When user calls this method via Data evaluation context, and it is not overridden by the subclass, it will fail with an error
   */
  public query?(data: DataEvaluationContext, options: Classifier["queryOptionsType"]): Promise<Classifier["queryType"]>;

  /**
   * If the collector uses any context, it should report it as dependency by overriding this function
   */
  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [];
  }

  protected pushOptions?(data: Classifier["optionsType"]): void;
  protected popOptions?(data: Classifier["optionsType"]): void;

  public get hasRegistered() {
    return this.registersCount > 0;
  }

  public register(data?: Classifier["optionsType"]) {
    ++this.registersCount;

    if (data !== undefined)
      this.pushOptions?.(data);
  }
  public unregister(data?: Classifier["optionsType"]) {
    --this.registersCount;

    if (data !== undefined)
      this.popOptions?.(data);
  }
}
