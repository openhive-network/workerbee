import { operation, TAccountName, TTransactionId } from "@hiveio/wax";
import { IFilter } from "./filter";
import { TReferencedDataCollectors } from "./data-collectors/collector";

/// TODO generate from IAccountData definition
export type TAccountMutableProperty = 'vests'|'hive';
export type TOperationType = operation[keyof operation];

export interface IFilterConfigurator {
  /**
   * Allows to construct filter trigerring when block with given number appear in blockchain.
   * @param num Absolute block number
   */
  onBlock(num: number): IConstructibleFilterConfigurator;
  /**
   * Allows to construct filter trigerring when block with given time appear in blockchain.
   * @param time Absolute (future) UTC time, to wait for given block.
   */
  onBlock(time: Date): IConstructibleFilterConfigurator;
  /**
   * Constructs a filter trigerring when block produced by given witness appear in blockchain.
   * @param witness name of watched witness account
   */
  onBlock(witness: TAccountName): IConstructibleFilterConfigurator;
  /**
   * Allows to construct filter triggering when one of specified mutable properties of given account will change.
   * @param name name of observed account
   * @param property watched property
   */
  onAccountPropertyChange(name: TAccountName, property: TAccountMutableProperty): IConstructibleFilterConfigurator;

  /**
   * Constructs a filter to watch blockchain until it accepts the transaction identified by given id.
   * @param id observed transaction id.
   * 
   */
  onTransaction(id: TTransactionId): IConstructibleFilterConfigurator;

  /**
   * Constructs a filter to watch any blockchain operation impacting specified account.
   * @param account name of observed account
   */
  onOperation(account: TAccountName): IConstructibleFilterConfigurator;
  /**
   * Constructs a filter to watch any blockchain operation matching given operation type and optional value pattern
   * (i.e. you can specify some operation property to watch).
   * @param pattern operation object where every defined property will be used as value pattern in the filter matching
   */
  onOperation<T extends TOperationType, TPattern = Partial<T>>(pattern?: TPattern): IConstructibleFilterConfigurator;
  /**
   * Constructs a filter to watch any blockchain operation impacting specified account, matching given operation type and optional
   * value pattern (i.e. you can specify some operation property to watch).
   * @param account name of observed account 
   * @param pattern operation object where every defined property will be used as value pattern in the filter matching
   */
  onOperation<T extends TOperationType, TPattern = Partial<T>>(account: TAccountName, pattern?: TPattern): IConstructibleFilterConfigurator;
};

export interface ICompositeFilterConfigurator {
  /**
   * Wraps all defined filters into ORed one, when one of satisfied filters triggers whole condition.
   */  
  or(): IFilterConfigurator;
  /**
   * Wraps all defined filters into AND'ed one, when all of satisfied conditions must be satified to trigger whole condition.
   * Implied implicitly.
   */
  and(): IFilterConfigurator;
};

export interface IConstructibleFilterConfigurator extends ICompositeFilterConfigurator, IFilterConfigurator /* remove to eliminate implicit and ability*/ {
  construct(): [IFilter, TReferencedDataCollectors];
}

export interface IFilterFactory extends IFilterConfigurator{
  
};
