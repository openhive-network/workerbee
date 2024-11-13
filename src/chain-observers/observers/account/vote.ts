import { vote } from "@hiveio/wax";
import { ProvidersData } from "src/chain-observers/providers-mediator";
import { ObserverBase } from "../observer-base";

export class VoteObserver extends ObserverBase<vote[]> {
  protected async retrieveData(providers: ProvidersData): Promise<vote[] | undefined> {
    const transactions = await providers.transactions;

    const voteOperations = transactions.getImpactedOperationsForAccount(this.options.impactedAccount!).filter(node => "vote" in node);

    return voteOperations.length === 0 ? undefined : voteOperations.map(operation => operation.vote!);
  }
}
