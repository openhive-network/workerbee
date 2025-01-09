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
  mentioned: TMentionedAccountProvided<TMentions>;
};

export class MentionedAccountProvider<TMentions extends Array<TAccountName> = Array<TAccountName>> extends ProviderBase {
  public constructor(
    private readonly accounts: TMentions
  ) {
    super();
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      OperationClassifier
    ];
  }

  public async provide(data: DataEvaluationContext): Promise<IMentionedAccountProviderData<TMentions>> {
    const mentioned: Record<string, comment[]> = Object.fromEntries(this.accounts.map(account => [account, []]));

    const { operationsPerType } = await data.get(OperationClassifier);

    for(const { operation } of (operationsPerType.comment ?? []))
      for(const account of this.accounts)
        try {
          const jsonMetadata = JSON.parse(operation.json_metadata);

          if ("users" in jsonMetadata && Array.isArray(jsonMetadata.users))
            if (jsonMetadata.users.indexOf(account) !== -1)
              mentioned[account].push(operation);
          // eslint-disable-next-line no-empty
        } catch {}

    const mentionedOutput = {} as TMentionedAccountProvided<TMentions>;

    for(const account in mentioned)
      mentionedOutput[account] = new WorkerBeeIterable(mentioned[account]);

    return {
      mentioned: mentionedOutput
    } as IMentionedAccountProviderData<TMentions>;
  }
}
