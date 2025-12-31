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
    let forceResolve = () => {};
    let forceReject = (_: WorkerBeeUnsatisfiedFilterError) => {};

    const forcePromise = new Promise<void>((resolve, reject) => {
      forceResolve = resolve;
      forceReject = reject;
    });

    /*
     * Resolve either when all operands resolve or when one of them resolves to forceResolveValue or rejects with forceCancelValue
     * Internal note: Promise.race is for OR logic, Promise.all is for AND logic
     */
    await Promise.race([
      Promise.all(
        this.operands.map(filter => filter.match(context).then(evaluationResult => {
          if(evaluationResult === forceResolveValue)
            forceResolve();
          else if (evaluationResult === forceCancelValue)
            forceReject(new WorkerBeeUnsatisfiedFilterError());
        }).catch(forceReject))
      ),
      forcePromise
    ]);
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
