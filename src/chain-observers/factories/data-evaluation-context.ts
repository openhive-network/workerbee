import { WorkerBeeError } from "../../errors";
import type * as TClassifiers from "../classifiers";
import { CollectorClassifierBase, IEvaluationContextClass } from "../classifiers/collector-classifier-base";

import { CollectorBase, TAvailableClassifiers } from "../collectors/collector-base";
import { FactoryBase } from "./factory-base";

export type TAvailableCollectorFunctions = {
  [key in keyof typeof TClassifiers]: CollectorBase;
};

export class DataEvaluationContext {
  private readonly cachedFunctions = new Map<CollectorBase, Promise<Partial<TAvailableClassifiers>>>();
  private readonly collectors: TAvailableCollectorFunctions = {} as TAvailableCollectorFunctions;

  public constructor(
    private readonly factory: FactoryBase
  ) {}

  public addTiming(name: string, time: number): void {
    this.factory.addTiming(name, time);
  }

  public inject<T extends IEvaluationContextClass>(
    evaluationContext: T,
    collector: CollectorBase
  ): void {
    if (this.collectors[evaluationContext.name] !== undefined)
      return; // Already registered

    this.collectors[evaluationContext.name] = collector;
  }

  /**
   * Available for dynamically pushing options from the classifier.
   */
  public pushClassifierOptions<T extends IEvaluationContextClass>(classifier: T, options: Record<string, unknown>) {
    const collector = this.collectors[classifier.name];
    if (!collector)
      throw new WorkerBeeError(`Could not find collector for classifier: "${classifier.name}" when pushing options`);

    collector.pushOptions(options);
  }

  /**
   * Available for dynamically popping options from the classifier.
   */
  public popClassifierOptions<T extends IEvaluationContextClass>(classifier: T, options: Record<string, unknown>) {
    const collector = this.collectors[classifier.name];
    if (!collector)
      throw new WorkerBeeError(`Could not find collector for classifier: "${classifier.name}" when popping options`);

    collector.popOptions(options);
  }

  public hasClassifierRegistered<T extends IEvaluationContextClass>(classifier: T): boolean {
    return this.collectors[classifier.name] !== undefined;
  }

  public async get<T extends IEvaluationContextClass, R = T extends new () => infer R ? R : never>(
    evaluationContext: T
  ): Promise<R extends CollectorClassifierBase ? R["type"] : never> {
    const collector = this.collectors[evaluationContext.name];

    if (collector === undefined)
      throw new WorkerBeeError(`Collector for evaluation context: "${evaluationContext.name}" not found`);

    let cached = this.cachedFunctions.get(collector);

    if (cached === undefined) {
      const startTime = Date.now();

      cached = (collector.fetchData(this) as Promise<any>).finally(() => {
        this.addTiming(evaluationContext.name, Date.now() - startTime);
      });

      for(const key in this.collectors)
        if (this.collectors[key] === collector)
          this.cachedFunctions.set(collector, cached!);
    }

    const result = await cached!;

    return result[evaluationContext.name] as any;
  }
}
