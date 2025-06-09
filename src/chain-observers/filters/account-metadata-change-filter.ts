import type { TAccountName } from "@hiveio/wax";
import type { WorkerBee } from "../../bot";
import { AccountClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { TFilterEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class AccountMetadataChangeFilter extends FilterBase {
  public constructor(
    worker: WorkerBee,
    accounts: TAccountName[]
  ) {
    super(worker);

    this.accounts = new Set(accounts);
  }

  private readonly accounts: Set<TAccountName>;

  public usedContexts(): Array<TRegisterEvaluationContext> {
    const classifiers: Array<TRegisterEvaluationContext> = [];
    for(const account of this.accounts)
      classifiers.push(AccountClassifier.forOptions({
        account
      }));

    return classifiers;
  }

  private previousJsonMetadata?: string;
  private previousPostingJsonMetadata?: string;

  public async match(data: TFilterEvaluationContext): Promise<boolean> {
    const { accounts } = await data.get(AccountClassifier);

    for(const accountName of this.accounts) {
      const account = accounts[accountName];

      if (account === undefined)
        return false;

      if (this.previousJsonMetadata === undefined) {
        this.previousJsonMetadata = JSON.stringify(account.jsonMetadata);
        this.previousPostingJsonMetadata = JSON.stringify(account.postingJsonMetadata);

        return false;
      }

      const postingMeta = JSON.stringify(account.postingJsonMetadata);
      const accMeta = JSON.stringify(account.jsonMetadata);

      const changedAccMeta = accMeta !== this.previousJsonMetadata;
      const changedPosting = postingMeta !== this.previousPostingJsonMetadata;

      this.previousJsonMetadata = accMeta;
      this.previousPostingJsonMetadata = postingMeta;

      if(changedAccMeta || changedPosting)
        return true;
    }

    return false;
  }
}
