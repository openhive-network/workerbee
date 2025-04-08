import { comment, TAccountName } from "@hiveio/wax";
import { WorkerBeeIterable } from "../../types/iterator";
import { OperationClassifier } from "../classifiers";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { DataEvaluationContext } from "../factories/data-evaluation-context";
import { ProviderBase } from "./provider-base";

export type TMentionedAccountProvided<TMentions extends Array<TAccountName>> = {
  [K in TMentions[number]]: WorkerBeeIterable<comment>;
};

export interface IMentionedAccountProviderData<TMentions extends Array<TAccountName>> {
  mentioned: Partial<TMentionedAccountProvided<TMentions>>;
};

export interface IMentionedAccountProviderOptions {
  accounts: string[];
}

export class MentionedAccountProvider<TMentions extends Array<TAccountName> = Array<TAccountName>> extends ProviderBase<IMentionedAccountProviderOptions> {
  public readonly accounts = new Set<TAccountName>();

  public pushOptions(options: IMentionedAccountProviderOptions): void {
    for(const account of options.accounts)
      this.accounts.add(account);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      OperationClassifier
    ];
  }

  public async provide(data: DataEvaluationContext): Promise<IMentionedAccountProviderData<TMentions>> {
    const mentioned = {} as IMentionedAccountProviderData<TMentions>["mentioned"];

    const { operationsPerType } = await data.get(OperationClassifier);

    if (operationsPerType.comment)
      for(const { operation } of operationsPerType.comment)
        for(const account of this.accounts)
          try {
            const jsonMetadata = JSON.parse(operation.json_metadata);

            if ("users" in jsonMetadata && Array.isArray(jsonMetadata.users))
              if (jsonMetadata.users.indexOf(account) !== -1)
                mentioned[account].push(operation);
            // eslint-disable-next-line no-empty
          } catch {}

    for(const account in mentioned)
      mentioned[account] = new WorkerBeeIterable(mentioned[account]);

    return {
      mentioned
    } as IMentionedAccountProviderData<TMentions>;
  }
}
