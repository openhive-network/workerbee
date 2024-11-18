import { AFilter } from "./filter-impl";
import { TReferencedDataCollectors, IDataEvaluationContext } from "../data-collectors/collector";
import { WorkerBeeUnsatisfiedFilterError } from "../../errors";

abstract class ACompositeFilter extends AFilter {
  public constructor(protected readonly operands: AFilter[]) {
    super();
  }

  public referencedCollectors(): TReferencedDataCollectors {
    const collectorSet: TReferencedDataCollectors = new Set();
    /// TODO replace with union
    for(const filter of this.operands)
      for(const c of filter.referencedCollectors())
        collectorSet.add(c);
    
    return collectorSet;
  }

  protected async evaluateOperands(context: IDataEvaluationContext, cancelingValue: boolean): Promise<boolean[]> {
    try {
    let cancelResolution = () => {};

    const cancellingPromise = new Promise<boolean[]>((_, reject) => {
      cancelResolution = () => {
        console.log("Cancelling evaluation...");
        reject(new WorkerBeeUnsatisfiedFilterError());
        //resolve([cancelingValue]);
        //throw new WorkerBeeUnsatisfiedFilterError();
      };
    });

    /*
     * If at least one of the filters resolves with undefined value,
     * throw to reject and ignore rest of the promises (Apply AND logic)
     */
    return await Promise.race([cancellingPromise,
      Promise.all(this.operands.map(filter => filter.evaluate(context).then(evaluationResult => {
        if(evaluationResult == cancelingValue)
          cancelResolution();

        return evaluationResult;
      })))
    ]);
  }
  catch(error) {
    console.log("Caught error");
    // Do not call user error listener if the error is an internal error
    if(typeof error === "object" && error instanceof WorkerBeeUnsatisfiedFilterError)
      return [cancelingValue];

    console.log("Rethrow unknown error");

    throw error;
  }
}
};

export class TLogicalAndFilter extends ACompositeFilter {
  public async evaluate(context: IDataEvaluationContext): Promise<boolean> {
    const evaluationResult = await this.evaluateOperands(context, false);
    for(const b of evaluationResult)
      if(b == false)
        return false;

    return true;
  }
};

export class TLogicalOrFilter extends ACompositeFilter {
  public async evaluate(context: IDataEvaluationContext): Promise<boolean> {
    const evaluationResult = await this.evaluateOperands(context, true);
    for(const b of evaluationResult)
      if(b)
        return true;

    return false;
  }

};