import {TAccountName} from "@hiveio/wax";

export enum TActionState {
  /// Indicates that the action is started and pending
  PENDING,
  /// Indicates that the action was processed (i.e. by L1 chain layer), but potentially not yet completed
  PROCESSED,
  /// Indicates that the action was processed and completed (i.e. by L2 chain layer)
  COMPLETED,
  /// Indicates that the action was rejected L1 chain layer
  REJECTED,
  /// Indicates that the action didn't change expected state in specified time (i.e. L2 chain layer didn't complete it)
  TIMEOUT
};

export interface IApplicationMutableProperty<T> {
  value(): T;

  /**
   * Indicates whether the action is still pending or has been completed.
   * @returns {TActionState} The current state of the action, COMPLETED value means action is settled on the backend side.
   */
  isSettled(): TActionState;
};

export interface IAccountListEntry {
  readonly account: IApplicationMutableProperty<TAccountName>;
};

export interface IFollowListEntry extends IAccountListEntry {
  readonly isFollowedBlog: IApplicationMutableProperty<boolean>;
  readonly isMuted: IApplicationMutableProperty<boolean>;
};

export interface IApplicationMutableList<T> {
  isSettled(): TActionState;
  /**
   * Returns the number of entries in the list. Not settled, means that some upcoming change is processing.
   */
  count(): IApplicationMutableProperty<number>;
  entries(): Iterable<T>;
};

/**
 * Represents the application state of the follow list specific to given account
 */
export interface IFollowListState extends IApplicationMutableList<IFollowListEntry> {
};

export interface IBlacklistedUserListState extends IApplicationMutableList<IAccountListEntry> {
};

export interface IMutedUserListState extends IApplicationMutableList<IAccountListEntry> {
};