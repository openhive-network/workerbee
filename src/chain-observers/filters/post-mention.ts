import { TAccountName } from "@hiveio/wax";
import type { WorkerBee } from "../../bot";
import { OperationClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { DataEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class PostMentionFilter extends FilterBase {
  public constructor(
    worker: WorkerBee,
    accounts: TAccountName[]
  ) {
    super(worker);

    this.accounts = new Set(accounts);
  }

  private readonly accounts: Set<TAccountName>;;

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
          for(const user of jsonMetadata.users)
            if (this.accounts.has(user))
              return true;
        // eslint-disable-next-line no-empty
      } catch {}

    return false;
  }
}
