import type { WorkerBee } from "../../bot";
import { BlockClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { DataEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class TransactionIdFilter extends FilterBase {
  public constructor(
    worker: WorkerBee,
    transactionIds: string[]
  ) {
    super(worker);

    this.transactionIds = new Set(transactionIds);
  }

  private readonly transactionIds: Set<string>;

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      BlockClassifier
    ];
  }

  public async match(data: DataEvaluationContext): Promise<boolean> {
    const block = await data.get(BlockClassifier);

    for(const transactionId of this.transactionIds)
      if(block.transactionsPerId.has(transactionId))
        return true;

    return false;
  }
}
