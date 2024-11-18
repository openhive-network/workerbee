import { TCollectableDataTypes, IDataEvaluationContext } from "./data-collectors/collector";
import { IAccountData, IBlockData, IBlockHeaderData, IImpactedAccountData, IOperationData , ITransactionData } from "../interfaces";

export interface IFilter {
  evaluate(evaluationContext: IDataEvaluationContext): Promise<boolean>;
};

/**
 * Allows to match filtering conditions defined during filter construction phase to the data provided by data collectors
 * used by specific filters.
 */
export interface ISpecificFilter<T extends TCollectableDataTypes> {
  match(collectedData: T): Promise<boolean>;
};

export type IBlockHeaderFilter = ISpecificFilter<IBlockHeaderData>;
export type IBlockFilter = ISpecificFilter<IBlockData>;
export type IAccountPropertyFilter = ISpecificFilter<IAccountData>;
export type IImpactedAccountFilter = ISpecificFilter<IImpactedAccountData>;
export type ITransactionFilter = ISpecificFilter<ITransactionData>;
export type IOperationFilter = ISpecificFilter<IOperationData>;
