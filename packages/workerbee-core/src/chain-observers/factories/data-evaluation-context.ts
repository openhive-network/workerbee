import { WorkerBeeError } from "../../errors";
import { createFactoryUnsupportedClassifierErrorMessage } from "../../utils/error-helper";
import type * as TClassifiers from "../classifiers";
import { CollectorClassifierBase, IEvaluationContextClass } from "../classifiers/collector-classifier-base";

import { CollectorBase, TAvailableClassifiers } from "../collectors/collector-base";
import { FactoryBase } from "./factory-base";

export type TAvailableCollectorFunctions = {
  [key in keyof typeof TClassifiers]: CollectorBase<InstanceType<(typeof TClassifiers)[key]>>;
};

export type TAvailableStores = {
  [key in keyof typeof TClassifiers]: InstanceType<(typeof TClassifiers)[key]>["storeType"];
};

export class DataEvaluationContext {
  private readonly cachedFunctions = new Map<CollectorBase<any>, Promise<Partial<TAvailableClassifiers>>>();
  private readonly storeData: TAvailableStores = {} as TAvailableStores;
  private readonly collectors: TAvailableCollectorFunctions = {} as TAvailableCollectorFunctions;

  private readonly factory: FactoryBase;

  public constructor(factory: FactoryBase) {
    this.factory = factory;
  }

  public addTiming(name: string, time: number): void {
    this.factory.addTiming(name, time);
  }

  public inject<T extends IEvaluationContextClass>(
    classifier: T,
    collector: CollectorBase<any>
  ): void {
    if (this.collectors[classifier.name] !== undefined)
      return; // Already registered

    this.collectors[classifier.name] = collector;
    this.storeData[classifier.name] = {};
  }

  public async get<Classifier extends CollectorClassifierBase<any, any, any, any, any>>(
    classifier: new (...args: any[]) => Classifier
  ): Promise<Classifier["getType"] extends void ? never : Classifier["getType"]> {
    const collector = this.collectors[classifier.name];

    if (collector === undefined)
      throw new WorkerBeeError(createFactoryUnsupportedClassifierErrorMessage((this.factory as any).__proto__.constructor.name, classifier));

    let cached = this.cachedFunctions.get(collector);

    if (cached === undefined) {
      const startTime = Date.now();

      if (collector.get === undefined)
        throw new WorkerBeeError(`Collector for classifier: "${classifier.name}" does not implement the requested "get" method`);

      cached = (collector.get(this) as Promise<any>).finally(() => {
        this.addTiming(`${classifier.name}#get`, Date.now() - startTime);
      });

      for(const key in this.collectors)
        if (this.collectors[key] === collector)
          this.cachedFunctions.set(collector, cached!);
    }

    const result = await cached!;

    return result[classifier.name] as any;
  }

  public async query<Classifier extends CollectorClassifierBase<any, any, any, any, any>>(
    classifier: new (...args: any[]) => Classifier,
    collectorOptions: Classifier["queryOptionsType"]
  ): Promise<Classifier["queryType"] extends void ? never : Classifier["queryType"]> {
    const collector = this.collectors[classifier.name];

    if (collector === undefined)
      throw new WorkerBeeError(createFactoryUnsupportedClassifierErrorMessage((this.factory as any).__proto__.constructor.name, classifier));

    const startTime = Date.now();

    if (collector.query === undefined)
      throw new WorkerBeeError(`Collector for classifier: "${classifier.name}" does not implement the requested "query" method`);

    return await (collector.query(this, collectorOptions) as Promise<any>).finally(() => {
      this.addTiming(`${classifier.name}#query`, Date.now() - startTime);
    });
  }

  public accessStore<Classifier extends CollectorClassifierBase<any, any, any, any, any>>(
    classifier: new (...args: any[]) => Classifier
  ): Classifier["storeType"] extends void ? never : Classifier["storeType"] {
    // Allow custom classifiers that are not registered, but have storeType defined
    const store = this.storeData[classifier.name] || (this.storeData[classifier.name] = {} as any);

    return store;
  }
}

// Collectors can get, query and access other collectors via `get` and `query`, and add timings for evaluation time analysis.
export type TCollectorEvaluationContext = Pick<DataEvaluationContext, "addTiming" | "get" | "query">;

/*
 * Filters and providers can get, query and access collectors. They should perform fast operations, so timings are not tracked for them.
 * Also they can get access to stores and share data with other filters and providers.
 */
export type TFilterEvaluationContext = Pick<DataEvaluationContext, "get" | "query" | "accessStore">;
export type TProviderEvaluationContext = Pick<DataEvaluationContext, "get" | "query" | "accessStore">;
