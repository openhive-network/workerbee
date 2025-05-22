import { TAccountName } from "@hiveio/wax";
import { WorkerBeeIterable } from "../../types/iterator";
import { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { ContentClassifier, IHiveContent } from "../classifiers/content-classifier";
import { DataEvaluationContext } from "../factories/data-evaluation-context";
import { ProviderBase } from "./provider-base";

export type TBlogContentMetadataProvided<TAccounts extends Array<TAccountName>> = {
  [K in TAccounts[number]]: Array<IHiveContent> | WorkerBeeIterable<IHiveContent>;
};

export interface IBlogContentMetadataroviderData<TAccounts extends Array<TAccountName>> {
  contentMetadataPerAccount: Partial<TBlogContentMetadataProvided<TAccounts>>;
};

export class BlogContentMetadataProvider<TAccounts extends Array<TAccountName> = Array<TAccountName>> extends ProviderBase {
  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [ContentClassifier];
  }

  public async provide(data: DataEvaluationContext): Promise<IBlogContentMetadataroviderData<TAccounts>> {
    const result = {
      contentMetadataPerAccount: {}
    };

    const content = await data.get(ContentClassifier);
    for(const account in content.contentData) {
      result.contentMetadataPerAccount[account] = content.contentData[account] ?? [];
      for(const post in content.contentData[account])
        result.contentMetadataPerAccount[account].push(content.contentData[account][post]);
    }

    return result as IBlogContentMetadataroviderData<TAccounts>;
  }
}
