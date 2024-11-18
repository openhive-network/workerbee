
import {IBlockData, IBlockHeaderData, IAccountData, IImpactedAccountData, IOperationData, IRcAccountData, ITransactionDataBase as ITransactionBaseData  } from "../../interfaces";

export interface IDataEvaluationContext {
  header(): Promise<IBlockHeaderData>;
  block(): Promise<IBlockData>;
  transaction(): Promise<ITransactionBaseData>;
  operation(): Promise<IOperationData>;
  account(): Promise<IAccountData>;
  rcAccount(): Promise<IRcAccountData>;
  impactedAccounts(): Promise<IImpactedAccountData>;
};

type DePromisify<T extends Promise<any>> = T extends Promise<infer R> ? R : T;

export type TCollectableDataTypes = DePromisify< ReturnType<IDataEvaluationContext[ keyof IDataEvaluationContext ]> >;

export type TReferencedDataCollectors = Set<keyof IDataEvaluationContext>;

export interface ICollector<T extends TCollectableDataTypes> {
  fetch(): Promise<T>;
};
