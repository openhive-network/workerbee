import { WitnessClassifier } from "../../classifiers";
import { IWitness } from "../../classifiers/witness-classifier";
import { DataEvaluationContext } from "../../factories/data-evaluation-context";
import { CollectorBase, TAvailableClassifiers } from "../collector-base";

export interface IWitnessCollectorOptions {
  witness: string;
}

const MAX_WITNESS_GET_LIMIT = 1000;

export class WitnessCollector extends CollectorBase {
  private readonly witnesses: Record<string, number> = {};

  protected pushOptions(data: IWitnessCollectorOptions): void {
    this.witnesses[data.witness] = (this.witnesses[data.witness] || 0) + 1;
  }

  protected popOptions(data: IWitnessCollectorOptions): void {
    this.witnesses[data.witness] = (this.witnesses[data.witness] || 1) - 1;

    if (this.witnesses[data.witness] === 0)
      delete this.witnesses[data.witness];
  }

  public async get(data: DataEvaluationContext) {
    const witnesses: Record<string, IWitness> = {};

    const witnessNames = Object.keys(this.witnesses);
    for (let i = 0; i < witnessNames.length; i += MAX_WITNESS_GET_LIMIT) {
      const chunk = witnessNames.slice(i, i + MAX_WITNESS_GET_LIMIT);

      const startFindWitnesses = Date.now();
      const { witnesses: owners } = await this.worker.chain!.api.database_api.find_witnesses({ owners: chunk });
      data.addTiming("database_api.find_witnesses", Date.now() - startFindWitnesses);

      for(const account of owners)
        witnesses[account.owner] = {
          owner: account.owner,
          runningVersion: account.running_version,
          totalMissedBlocks: account.total_missed,
          lastConfirmedBlockNum: account.last_confirmed_block_num
        };
    }

    return {
      [WitnessClassifier.name]: {
        witnesses
      } as TAvailableClassifiers["WitnessClassifier"]
    } satisfies Partial<TAvailableClassifiers>;
  };
}
