import { IDataEvaluationContext, TReferencedDataCollectors } from "../data-collectors/collector";
import { IFilter } from "../filter";

export abstract class AFilter implements IFilter {

  /**
   * Defined to satisfy IFilter needs.
   */
  public abstract evaluate(context: IDataEvaluationContext): Promise<boolean>;

  /**
   * Specifies which providers will be requried for this filter
   */
  public abstract referencedCollectors(): TReferencedDataCollectors;

  protected constructor() {
  }
};
