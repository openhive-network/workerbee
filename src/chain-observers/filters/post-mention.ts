import { TAccountName } from "@hiveio/wax";
import type { WorkerBee } from "../../bot";
import { OperationClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { TFilterEvaluationContext } from "../factories/data-evaluation-context";
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

  public async match(data: TFilterEvaluationContext): Promise<boolean> {
    const { operationsPerType } = await data.get(OperationClassifier);

    for(const { operation: { body } } of (operationsPerType.comment ?? [])) {
      // Use regex to find all account mentions in the form of @username
      const mentionRegex = /@([a-z0-9.-]+)/gi;
      let match: RegExpExecArray | null;
      while ((match = mentionRegex.exec(body)) !== null) {
        const mentionedAccount = match[1] as TAccountName;
        if (this.accounts.has(mentionedAccount))
          return true;
      }
    }

    return false;
  }
}
