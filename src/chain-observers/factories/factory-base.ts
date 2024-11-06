import type { WorkerBee } from "../../bot";
import { IEvaluationContextClass, TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { CollectorBase } from "../collectors/collector-base";
import { DataEvaluationContext } from "./data-evaluation-context";

export class FactoryBase {
  protected collectors!: Map<IEvaluationContextClass, CollectorBase>;

  public constructor(
    protected readonly worker: WorkerBee
  ) {}

  public pushClassifier(classifier: TRegisterEvaluationContext): void {
    const classifierClass = "class" in classifier ? classifier.class : classifier;

    const instance = this.collectors.get(classifierClass);
    if (instance === undefined)
      throw new Error(`Classifier "${classifierClass.name}" is not supported by factory "${(this as any).__proto__.constructor.name}"`);

    instance.register("options" in classifier ? classifier.options : undefined);

    for(const dependency of instance.usedContexts())
      this.pushClassifier(dependency);
  }

  public popClassifier(classifier: TRegisterEvaluationContext): void {
    const classifierClass = "class" in classifier ? classifier.class : classifier;

    const instance = this.collectors.get(classifierClass);
    if (instance === undefined)
      throw new Error(`Classifier "${classifierClass.name}" is not supported by factory "${(this as any).__proto__.constructor.name}"`);

    instance.unregister("options" in classifier ? classifier.options : undefined);

    for(const dependency of instance.usedContexts())
      this.popClassifier(dependency);
  }

  private rebuildDataEvaluationContext(): DataEvaluationContext {
    const context = new DataEvaluationContext();

    for(const [contextClass, collectorInstance] of this.collectors) {
      // XXX: Rewrite this on overriding logic:
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
