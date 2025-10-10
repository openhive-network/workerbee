import { comment, TAccountName } from "@hiveio/wax";
import { WorkerBeeIterable } from "../../types/iterator";
import { OperationClassifier } from "../classifiers";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { TProviderEvaluationContext } from "../factories/data-evaluation-context";
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

  public async provide(data: TProviderEvaluationContext): Promise<IMentionedAccountProviderData<TMentions>> {
    const mentioned = {} as IMentionedAccountProviderData<TMentions>["mentioned"];

    const { operationsPerType } = await data.get(OperationClassifier);

    const postMetadataSet = new Set<string>();

    if (operationsPerType.comment_operation)
      for(const { operation } of operationsPerType.comment_operation) {
        const postHash = `${operation.author}-${operation.permlink}`;

        if (postMetadataSet.has(postHash))
          continue;

        postMetadataSet.add(postHash);

        const mentionRegex = /@[a-z]+[a-z0-9.-]+[a-z0-9]+\b/g;
        let match: RegExpExecArray | null;
        let foundMention = false;
        while ((match = mentionRegex.exec(operation.body)) !== null && !foundMention) {
          const mentionedAccount = match[1] as TAccountName;
          if (this.accounts.has(mentionedAccount)) {
            if (!mentioned[mentionedAccount])
              mentioned[mentionedAccount] = [];

            mentioned[mentionedAccount].push(operation);
            foundMention = true;
          }
        }
      }

    for(const account in mentioned)
      mentioned[account] = new WorkerBeeIterable(mentioned[account]);

    return {
      mentioned
    } as IMentionedAccountProviderData<TMentions>;
  }
}
