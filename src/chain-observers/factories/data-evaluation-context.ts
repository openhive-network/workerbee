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

  public async get<T extends IEvaluationContextClass, R = T extends new () => infer R ? R : never>(
    evaluationContext: T
  ): Promise<R extends CollectorClassifierBase ? R["type"] : never> {
    const collector = this.collectors[evaluationContext.name];

    if (collector === undefined)
      throw new WorkerBeeError(`Collector for evaluation context: "${evaluationContext.name}" not found`);

    let cached = this.cachedFunctions.get(collector);

    if (cached === undefined) {
      const startTime = Date.now();

      if (collector.get === undefined)
        throw new WorkerBeeError(`Collector for evaluation context: "${evaluationContext.name}" does not implement the requested "get" method`);

      cached = (collector.get(this) as Promise<any>).finally(() => {
        this.addTiming(`${evaluationContext.name}#get`, Date.now() - startTime);
      });

      for(const key in this.collectors)
        if (this.collectors[key] === collector)
          this.cachedFunctions.set(collector, cached!);
    }

    const result = await cached!;

    return result[evaluationContext.name] as any;
  }

  public async query<T extends IEvaluationContextClass, R = T extends new () => infer R ? R : never>(
    evaluationContext: T,
    collectorOptions: object
  ): Promise<R extends CollectorClassifierBase ? R["type"] : never> {
    const collector = this.collectors[evaluationContext.name];

    if (collector === undefined)
      throw new WorkerBeeError(`Collector for evaluation context: "${evaluationContext.name}" not found`);

    const startTime = Date.now();

    if (collector.query === undefined)
      throw new WorkerBeeError(`Collector for evaluation context: "${evaluationContext.name}" does not implement the requested "query" method`);

    return await (collector.query(this, collectorOptions) as Promise<any>).finally(() => {
      this.addTiming(`${evaluationContext.name}#query`, Date.now() - startTime);
    });
  }
}
