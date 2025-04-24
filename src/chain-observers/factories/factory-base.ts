import type { WorkerBee } from "../../bot";
import { WorkerBeeError } from "../../errors";
import { createFactoryCircularDependencyErrorMessage, createFactoryUnsupportedClassifierErrorMessage } from "../../utils/error-helper";
import { IEvaluationContextClass, TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { CollectorBase } from "../collectors/collector-base";
import { ObserverMediator } from "../observer-mediator";
import { DataEvaluationContext } from "./data-evaluation-context";

export enum EClassifierOrigin {
  FILTER = "filter",
  PROVIDER = "provider",
  FACTORY = "factory"
}

export class FactoryBase {
  protected collectors!: Map<IEvaluationContextClass, CollectorBase>;

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

  public preNotify(_mediator: ObserverMediator): void {}
  public postNotify(_mediator: ObserverMediator, _context: DataEvaluationContext): void {}

  public pushClassifier(classifier: TRegisterEvaluationContext, origin: EClassifierOrigin, stack: IEvaluationContextClass[] = []): void {
    const classifierClass = "class" in classifier ? classifier.class : classifier;

    if (stack.includes(classifierClass))
      throw new WorkerBeeError(createFactoryCircularDependencyErrorMessage((this as any).__proto__.constructor.name, classifierClass, origin, stack));

    stack.push(classifierClass);

    const instance = this.collectors.get(classifierClass);
    if (instance === undefined)
      throw new WorkerBeeError(createFactoryUnsupportedClassifierErrorMessage((this as any).__proto__.constructor.name, classifierClass, origin, stack));

    instance.register("options" in classifier ? classifier.options : undefined);

    for(const dependency of instance.usedContexts()) // Rewrite stack to avoid detecting false circular dependencies when on the same nested level
      this.pushClassifier(dependency, origin, [...stack]);
  }

  public popClassifier(classifier: TRegisterEvaluationContext, origin: EClassifierOrigin, stack: IEvaluationContextClass[] = []): void {
    const classifierClass = "class" in classifier ? classifier.class : classifier;

    if (stack.includes(classifierClass))
      throw new WorkerBeeError(createFactoryCircularDependencyErrorMessage((this as any).__proto__.constructor.name, classifierClass, origin, stack));

    stack.push(classifierClass);

    const instance = this.collectors.get(classifierClass);
    if (instance === undefined)
      throw new WorkerBeeError(createFactoryUnsupportedClassifierErrorMessage((this as any).__proto__.constructor.name, classifierClass, origin, stack));

    instance.unregister("options" in classifier ? classifier.options : undefined);

    for(const dependency of instance.usedContexts()) // Rewrite stack to avoid detecting false circular dependencies when on the same nested level
      this.popClassifier(dependency, origin, [...stack]);
  }

  private rebuildDataEvaluationContext(): DataEvaluationContext {
    const context = new DataEvaluationContext(this);

    for(const [contextClass, collectorInstance] of this.collectors) {
      if (!collectorInstance.hasRegistered) // Ignore collectors that have no registered classifiers
        continue;

      // Dependencies are already pushed by the classifier

      context.inject(contextClass, collectorInstance);
    }

    return context;
  }

  public collect(): DataEvaluationContext {
    return this.rebuildDataEvaluationContext();
  }
}
