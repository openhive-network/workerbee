import { vote } from "@hiveio/wax";
import { ObserverBase } from "../observer-base";
import type { IDataProviderOptionsForAccount, TDataProviderForOptions } from "../register/register";

export interface IVoteObserverOptions extends IDataProviderOptionsForAccount {}

export class VoteObserver extends ObserverBase<vote[], IVoteObserverOptions> {
  protected retrieveData(dataProvider: TDataProviderForOptions<IVoteObserverOptions>): vote[] | undefined {
    const voteOperations = dataProvider.account.impactedOperations.filter(({ operation }) => operation.vote !== undefined);

    return voteOperations.length === 0 ? undefined : voteOperations.map(({ operation }) => operation.vote!);
  }
}
