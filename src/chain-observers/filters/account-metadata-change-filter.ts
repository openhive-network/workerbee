import type { TAccountName } from "@hiveio/wax";
import { AccountClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import type { TFilterEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class AccountMetadataChangeFilter extends FilterBase {
  public constructor(
    accounts: TAccountName[]
  ) {
    super();

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

  private previousMetadataByAccount = new Map<TAccountName, { jsonMetadata: string; postingJsonMetadata: string }>();

  public async match(data: TFilterEvaluationContext): Promise<boolean> {
    const { accounts } = await data.get(AccountClassifier);

    for(const accountName of this.accounts) {
      const account = accounts[accountName];

      if (account === undefined)
        return false;

      const postingMeta = JSON.stringify(account.postingJsonMetadata);
      const accMeta = JSON.stringify(account.jsonMetadata);

      const previous = this.previousMetadataByAccount.get(accountName);
      if (previous === undefined) {
        this.previousMetadataByAccount.set(accountName, {
          jsonMetadata: accMeta,
          postingJsonMetadata: postingMeta
        });

        continue;
      }

      const changedAccMeta = accMeta !== previous.jsonMetadata;
      const changedPosting = postingMeta !== previous.postingJsonMetadata;

      this.previousMetadataByAccount.set(accountName, {
        jsonMetadata: accMeta,
        postingJsonMetadata: postingMeta
      });

      if(changedAccMeta || changedPosting)
        return true;
    }

    return false;
  }
}
