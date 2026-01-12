import type { WorkerBee } from "../../bot";
import { WorkerBeeError } from "../../errors";
import { createFactoryCircularDependencyErrorMessage, createFactoryUnsupportedClassifierErrorMessage } from "../../utils/error-helper";
import { DynamicGlobalPropertiesClassifier } from "../classifiers";
import { CollectorClassifierBase, IEvaluationContextClass, TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { CollectorBase } from "../collectors/collector-base";
import { ObserverMediator } from "../observer-mediator";
import { DataEvaluationContext } from "./data-evaluation-context";

export enum EClassifierOrigin {
  FILTER = "filter",
  PROVIDER = "provider",
  FACTORY = "factory"
}

export type AnyCollectorClass = new (...args: any[]) => CollectorBase<CollectorClassifierBase<any, any, any, any, any>>;

export class FactoryBase {
  protected collectors = new Map<AnyCollectorClass, CollectorBase<CollectorClassifierBase<any, any, any, any, any>>>();
  protected collectorsPerClassifier = new Map<IEvaluationContextClass, AnyCollectorClass>();
  protected currentBlockNumber?: number;

  public constructor(
    protected readonly worker: WorkerBee
  ) {}

  private readonly timings: Record<string, number> = {};
  private lastStart = Date.now();

  public getTimings(): Readonly<Record<string, number>> {
    this.timings.total = Date.now() - this.lastStart;
    return this.timings;
  }

  public addTiming(name: string, time: number) {
    this.timings[name] = (this.timings[name] ?? 0) + time;
  }

  /**
   * Should be called to register a classifier with a collector.
   * If the collector is already registered for the classifier, or not yet registered, it will return false.
   * If the collector is different, it will replace the existing one and return true.
   */
  public registerClassifier<
    Classifier extends IEvaluationContextClass,
    Collector extends AnyCollectorClass
  >(classifier: Classifier, collector: Collector, ...constructorArgs: ConstructorParameters<Collector>): boolean {
    const existingCollector = this.collectorsPerClassifier.get(classifier);
    if (existingCollector === collector)
      return false; // Collector already registered for this classifier and is the same class

    /*
     * If the collector is already registered for a different classifier,
     * we need to assign the reference of the existing collector instance to the new classifier to use the same data between classifiers
     * This is useful for cases when the same collector provides data for multiple classifiers
     */
    const collectorInstance = this.collectors.get(collector);
    if (collectorInstance !== undefined) {
      this.collectorsPerClassifier.set(classifier, collector);
      this.collectors.set(collector, collectorInstance);
      return false;
    }

    this.collectorsPerClassifier.set(classifier, collector);
    this.collectors.set(collector, new collector(...constructorArgs));

    return existingCollector === collector;
  }

  /**
   * Should be called to unregister a classifier from a collector.
   * If the collector is not registered for the classifier, it will return false.
   * If the collector is registered, it will remove it and return true.
   */
  public unregisterClassifier(classifier: IEvaluationContextClass): boolean {
    const collector = this.collectorsPerClassifier.get(classifier);
    if (collector === undefined)
      return false; // No collector registered for this classifier

    this.collectorsPerClassifier.delete(classifier);

    const collectorInstance = this.collectors.get(collector);
    if (collectorInstance === undefined)
      return false; // No collector instance registered for this classifier

    this.collectors.delete(collector);

    return true; // Successfully unregistered the collector
  }

  /**
   * Should be called to extend the factory with another factory's collectors.
   * It will register all collectors from the other factory that are not already registered in this factory.
   */
  public extend(other: FactoryBase): void {
    for(const [classifier, otherCollector] of other.collectorsPerClassifier) {
      const thisCollector = this.collectorsPerClassifier.get(classifier);

      if (thisCollector === undefined)
        continue; // Not registered in this factory, so it is unsupported - we will not register it

      // Already registered, just update the instance reference to use collected data from the other factory
      if (thisCollector === otherCollector) {
        const existingOtherCollectorInstance = other.collectors.get(otherCollector);
        if (existingOtherCollectorInstance === undefined)
          throw new WorkerBeeError(
            `Internal error: Collector instance not found for classifier ${classifier.name} in factory ${(other as any).__proto__.constructor.name}`
          );

        this.collectors.set(thisCollector, existingOtherCollectorInstance);
      }
    }
  }

  /**
   * Called by mediator before any notification processing begins for a data collection cycle.
   * This method determines whether the factory should proceed with processing the current cycle.
   * If this method returns true, filters, providers, callbacks and {@link postNotify} will be executed normally.
   * If this method returns false, the entire processing cycle will be skipped, including filters, providers, callbacks and {@link postNotify}.
   */
  public async preNotify(context: DataEvaluationContext, _mediator: ObserverMediator): Promise<boolean> {
    // If this is the first run (no previous block processed), we should proceed
    const dgp = await context.get(DynamicGlobalPropertiesClassifier);

    /*
     * If the current head block is different from the last processed block, we should proceed
     * Will be also true for the first run as currentBlockNumber is undefined
     */
    const hasBlockNumberChanged = this.currentBlockNumber !== dgp.headBlockNumber;

    if (hasBlockNumberChanged)
      this.currentBlockNumber = this.currentBlockNumber ? this.currentBlockNumber + 1 : dgp.headBlockNumber;

    // If we've already processed this block, skip processing
    return hasBlockNumberChanged;
  }

  /**
   * Called by mediator after all notification processing has completed for a data collection cycle.
   * This method provides an opportunity to perform cleanup, finalization, or post-processing
   * tasks after all observers have been notified.
   * Note: Getting inside this method does not mean all filters and callbacks has been processed (ended).
   */
  public async postNotify(_context: DataEvaluationContext, _mediator: ObserverMediator): Promise<void> {}

  public pushClassifier(classifier: TRegisterEvaluationContext, origin: EClassifierOrigin, stack: IEvaluationContextClass[] = []): void {
    const classifierClass = "class" in classifier ? classifier.class : classifier;

    if (stack.includes(classifierClass))
      throw new WorkerBeeError(createFactoryCircularDependencyErrorMessage((this as any).__proto__.constructor.name, classifierClass, origin, stack));

    stack.push(classifierClass);

    const collector = this.collectorsPerClassifier.get(classifierClass);
    if (collector === undefined)
      throw new WorkerBeeError(createFactoryUnsupportedClassifierErrorMessage((this as any).__proto__.constructor.name, classifierClass, origin, stack));

    const instance = this.collectors.get(collector);
    if (instance === undefined)
      throw new WorkerBeeError(
        `Internal error: Collector instance not found for classifier ${classifierClass.name} in factory ${(this as any).__proto__.constructor.name}`
      );

    instance.register("options" in classifier ? classifier.options : undefined);

    for(const dependency of instance.usedContexts()) // Rewrite stack to avoid detecting false circular dependencies when on the same nested level
      this.pushClassifier(dependency, origin, [...stack]);
  }

  public popClassifier(classifier: TRegisterEvaluationContext, origin: EClassifierOrigin, stack: IEvaluationContextClass[] = []): void {
    const classifierClass = "class" in classifier ? classifier.class : classifier;

    if (stack.includes(classifierClass))
      throw new WorkerBeeError(createFactoryCircularDependencyErrorMessage((this as any).__proto__.constructor.name, classifierClass, origin, stack));

    stack.push(classifierClass);

    const collector = this.collectorsPerClassifier.get(classifierClass);
    if (collector === undefined)
      throw new WorkerBeeError(createFactoryUnsupportedClassifierErrorMessage((this as any).__proto__.constructor.name, classifierClass, origin, stack));

    const instance = this.collectors.get(collector);
    if (instance === undefined)
      throw new WorkerBeeError(
        `Internal error: Collector instance not found for classifier ${classifierClass.name} in factory ${(this as any).__proto__.constructor.name}`
      );

    instance.unregister("options" in classifier ? classifier.options : undefined);

    for(const dependency of instance.usedContexts()) // Rewrite stack to avoid detecting false circular dependencies when on the same nested level
      this.popClassifier(dependency, origin, [...stack]);
  }

  private rebuildDataEvaluationContext(): DataEvaluationContext {
    const context = new DataEvaluationContext(this);

    for(const [classifier, collector] of this.collectorsPerClassifier) {
      const collectorInstance = this.collectors.get(collector);
      if (collectorInstance === undefined)
        throw new WorkerBeeError(
          `Internal error: Collector instance not found for classifier ${classifier.name} in factory ${(this as any).__proto__.constructor.name}`
        );

      if (!collectorInstance.hasRegistered) // Ignore collectors that have no registered classifiers
        continue;

      // Dependencies are already pushed by the classifier

      context.inject(classifier, collectorInstance);
    }

    return context;
  }

  public collect(): DataEvaluationContext {
    return this.rebuildDataEvaluationContext();
  }
}
