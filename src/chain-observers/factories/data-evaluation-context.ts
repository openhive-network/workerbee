import { WorkerBeeError } from "../../errors";
import type * as TClassifiers from "../classifiers";
import { CollectorClassifierBase, IEvaluationContextClass } from "../classifiers/collector-classifier-base";

import { CollectorBase, TAvailableClassifiers } from "../collectors/collector-base";

export type TAvailableCollectorFunctions = {
  [key in keyof typeof TClassifiers]: CollectorBase;
};

export class DataEvaluationContext {
  private readonly cachedFunctions = new Map<CollectorBase, Promise<Partial<TAvailableClassifiers>>>();
  private readonly collectors: TAvailableCollectorFunctions = {} as TAvailableCollectorFunctions;

  public inject<T extends IEvaluationContextClass>(
    evaluationContext: T,
    collector: CollectorBase
  ): void {
    if (this.collectors[evaluationContext.name] !== undefined)
      return; // Already registered

    this.collectors[evaluationContext.name] = collector;
  }

  public async get<T extends IEvaluationContextClass, R = T extends new () => infer R ? R : never>(
    evaluationContext: T
  ): Promise<R extends CollectorClassifierBase ? R["type"] : never> {
    const collector = this.collectors[evaluationContext.name];

    if (collector === undefined)
      throw new WorkerBeeError(`Collector for evaluation context: "${evaluationContext.name}" not found`);

    let cached = this.cachedFunctions.get(collector);

    if (cached === undefined) {
      cached = collector.fetchData(this);

      this.cachedFunctions.set(collector, cached!);
    }

    const result = await cached!;

    return result[evaluationContext.name] as any;
  }
}
