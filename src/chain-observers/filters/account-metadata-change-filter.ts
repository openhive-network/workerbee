import type { WorkerBee } from "../../bot";
import { AccountClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { DataEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class AccountMetadataChangeFilter extends FilterBase {
  public constructor(
    worker: WorkerBee,
    private readonly account: string
  ) {
    super(worker);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      AccountClassifier.forOptions({
        account: this.account
      })
    ];
  }

  private previousJsonMetadata?: string;
  private previousPostingJsonMetadata?: string;

  public async match(data: DataEvaluationContext): Promise<boolean> {
    const { accounts } = await data.get(AccountClassifier);

    const account = accounts[this.account];

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

    return changedAccMeta || changedPosting;
  }
}
