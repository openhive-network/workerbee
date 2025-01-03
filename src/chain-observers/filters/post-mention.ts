import type { WorkerBee } from "../../bot";
import { OperationClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { DataEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class PostMentionFilter extends FilterBase {
  public constructor(
    worker: WorkerBee,
    private readonly account: string
  ) {
    super(worker);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      OperationClassifier
    ];
  }

  public async match(data: DataEvaluationContext): Promise<boolean> {
    const { operationsPerType } = await data.get(OperationClassifier);

    for(const { operation } of (operationsPerType.comment ?? []))
      try {
        const jsonMetadata = JSON.parse(operation.json_metadata);

        if ("users" in jsonMetadata && Array.isArray(jsonMetadata.users))
          if (jsonMetadata.users.indexOf(this.account) !== -1)
            return true;
        // eslint-disable-next-line no-empty
      } catch {}

    return false;
  }
}
