import { WorkerBeeUnsatisfiedFilterError } from "../../errors";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { TFilterEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "../filters/filter-base";

abstract class CompositeFilter extends FilterBase {
  protected readonly operands: FilterBase[];

  public constructor(
    operands: FilterBase[]
  ) {
    super();

    this.operands = operands;
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    const collectorSet = new Set<TRegisterEvaluationContext>();
    for(const operand of this.operands)
      for(const collector of operand.usedContexts())
        collectorSet.add(collector);

    return [...collectorSet];
  }

  protected async evaluateOperands(context: TFilterEvaluationContext, forceCancelValue?: boolean, forceResolveValue?: boolean): Promise<void> {
    const requiresForceResolve = forceResolveValue !== undefined;

    for(const filter of this.operands) {
      const evaluationResult = await filter.match(context);

      if(requiresForceResolve && evaluationResult === forceResolveValue)
        return;

      if(forceCancelValue !== undefined && evaluationResult === forceCancelValue)
        throw new WorkerBeeUnsatisfiedFilterError();
    }

    if(requiresForceResolve)
      throw new WorkerBeeUnsatisfiedFilterError();
  }
};

export class LogicalAndFilter extends CompositeFilter {
  public async match(context: TFilterEvaluationContext): Promise<boolean> {
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
  public async match(context: TFilterEvaluationContext): Promise<boolean> {
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
