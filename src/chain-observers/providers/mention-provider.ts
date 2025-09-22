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

export class MentionedAccountProvider<
  TMentions extends Array<TAccountName> = Array<TAccountName>
> extends ProviderBase<IMentionedAccountProviderOptions, IMentionedAccountProviderData<TMentions>> {
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

  public get baseStructure(): IMentionedAccountProviderData<TMentions> {
    return {
      mentioned: {}
    };
  }

  public async provide(data: TProviderEvaluationContext): Promise<IMentionedAccountProviderData<TMentions>> {
    const result = this.baseStructure;

    const { operationsPerType } = await data.get(OperationClassifier);

    const postMetadataSet = new Set<string>();

    if (operationsPerType.comment_operation)
      for(const { operation } of operationsPerType.comment_operation) {
        const postHash = `${operation.author}-${operation.permlink}`;

        if (postMetadataSet.has(postHash))
          continue;

        postMetadataSet.add(postHash);

        const mentionRegex = /@([a-z0-9.-]+)/gi;
        let match: RegExpExecArray | null;
        let foundMention = false;
        while ((match = mentionRegex.exec(operation.body)) !== null && !foundMention) {
          const mentionedAccount = match[1] as TAccountName;
          if (this.accounts.has(mentionedAccount)) {
            if (!result.mentioned[mentionedAccount])
              result.mentioned[mentionedAccount] = [];

            result.mentioned[mentionedAccount].push(operation);
            foundMention = true;
          }
        }
      }

    for(const account in result.mentioned)
      result.mentioned[account] = new WorkerBeeIterable(result.mentioned[account]);

    return result;
  }
}
