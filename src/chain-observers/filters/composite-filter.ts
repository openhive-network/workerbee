import type { WorkerBee } from "../../bot";
import { WorkerBeeUnsatisfiedFilterError } from "../../errors";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { DataEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "../filters/filter-base";

abstract class CompositeFilter extends FilterBase {
  public constructor(
    worker: WorkerBee,
    protected readonly operands: FilterBase[]
  ) {
    super(worker);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    const collectorSet = new Set<TRegisterEvaluationContext>();
    for(const operand of this.operands)
      for(const collector of operand.usedContexts())
        collectorSet.add(collector);

    return [...collectorSet];
  }

  protected async evaluateOperands(context: DataEvaluationContext, forceCancelValue?: boolean, forceResolveValue?: boolean): Promise<void> {
    let forceResolve = () => {};
    let forceReject = (_: WorkerBeeUnsatisfiedFilterError) => {};

    const forcePromise = new Promise<void>((resolve, reject) => {
      forceResolve = resolve;
      forceReject = reject;
    });

    this.operands.map((filter) => filter.match(context).then(evaluationResult => {
      if(evaluationResult === forceResolveValue)
        forceResolve();
      else if (evaluationResult === forceCancelValue)
        forceReject(new WorkerBeeUnsatisfiedFilterError());

      return evaluationResult;
    }));

    await forcePromise;
  }
};

export class LogicalAndFilter extends CompositeFilter {
  public async match(context: DataEvaluationContext): Promise<boolean> {
    try {
      await this.evaluateOperands(context, false);

      return true;
    } catch(error) {
      if(typeof error === "object" && error instanceof WorkerBeeUnsatisfiedFilterError)
        return false;

      throw error;
    }
  }
};

export class LogicalOrFilter extends CompositeFilter {
  public async match(context: DataEvaluationContext): Promise<boolean> {
    try {
      await this.evaluateOperands(context, undefined, true);

      return true;
    } catch(error) {
      if(typeof error === "object" && error instanceof WorkerBeeUnsatisfiedFilterError)
        return false;

      throw error;
    }
  }
};
