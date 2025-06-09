import { TAccountName } from "@hiveio/wax";
import Long from "long";
import { BucketAggregateQueue } from "../../../types/queue";
import { ContentMetadataClassifier } from "../../classifiers";
import { IHiveContentMetadata, TContentMetadataQueryData } from "../../classifiers/content-metadata-classifier";
import { TCollectorEvaluationContext } from "../../factories/data-evaluation-context";
import { CollectorBase, TAvailableClassifiers } from "../collector-base";

export const BUCKET_INTERVAL = 3 * 1000; // 3 seconds (Hive block interval)

const MAX_CONTENT_GET_LIMIT = 1000;

export class ContentMetadataCollector extends CollectorBase<ContentMetadataClassifier> {
  private readonly contractTimestamps = new BucketAggregateQueue<TContentMetadataQueryData>(BUCKET_INTERVAL);
  private readonly contentCached = new Set<string>();

  private async retrieveData(data: TCollectorEvaluationContext, requestData: Array<[TAccountName, string]>) {
    const contentData: Record<TAccountName, Record<string, IHiveContentMetadata>> = {};
    for (let i = 0; i < requestData.length; i += MAX_CONTENT_GET_LIMIT) {
      const chunk = requestData.slice(i, i + MAX_CONTENT_GET_LIMIT);

      const startFindComments = Date.now();
      const { comments } = await this.worker.chain!.api.database_api.find_comments({ comments: chunk });
      data.addTiming("database_api.find_comments", Date.now() - startFindComments);

      const startCommentsAnalysis = Date.now();

      for(const comment of comments) {
        contentData[comment.author] = contentData[comment.author] || {};

        const payoutTime = new Date(`${comment.cashout_time}Z`);

        contentData[comment.author][comment.permlink] = {
          author: comment.author,
          permlink: comment.permlink,
          parentAuthor: comment.parent_author,
          parentPermlink: comment.parent_permlink,
          allowsCurationRewards: comment.allow_curation_rewards,
          allowsReplies: comment.allow_replies,
          allowsVotes: comment.allow_votes,
          authorRewards: Long.fromValue(comment.author_rewards),
          beneficiaries: comment.beneficiaries,
          category: comment.category,
          created: new Date(`${comment.created}Z`),
          curatorPayoutValue: comment.curator_payout_value,
          depth: comment.depth,
          lastUpdated: new Date(`${comment.last_update}Z`),
          netRshares: Long.fromValue(comment.net_rshares),
          netVotes: comment.net_votes,
          payoutTime: payoutTime,
          isPaid: payoutTime.getTime() <= 0,
          replyCount: comment.children,
          totalPayoutValue: comment.total_payout_value,
          title: comment.title
        };
      }

      data.addTiming("commentsAnalysis", Date.now() - startCommentsAnalysis);
    }

    return contentData;
  }

  public async query(data: TCollectorEvaluationContext, options: ContentMetadataClassifier["queryOptionsType"]) {
    // First retrieve data:
    const contentData = await this.retrieveData(data, options.requestedData);

    if (options.reportAfterMsBeforePayout)
      // Then enqueue it for future processing:
      for(const author in contentData)
        for(const permlink in contentData[author]) {
          const postMetadata = contentData[author][permlink];
          if (postMetadata.isPaid)
            continue; // Skip already paid posts

          const cacheKey = `${author}/${permlink}`;

          const rollbackAfter = postMetadata.payoutTime.getTime() - options.reportAfterMsBeforePayout;

          if (this.contentCached.has(cacheKey))
            // If we already have this content, we don't need to enqueue it again
            continue;

          this.contractTimestamps.enqueue(rollbackAfter, [author, permlink]);
          this.contentCached.add(cacheKey);
        }

    return {
      contentData
    };
  }

  public async get(data: TCollectorEvaluationContext) {
    const allData: TContentMetadataQueryData[] = [];

    // Now we can operate on the enqueued data:
    const currentTime = Date.now();
    for(const value of this.contractTimestamps.dequeueUntil(currentTime)) {
      allData.push(value);

      // Cleanup
      this.contentCached.delete(`${value[0]}/${value[1]}`);
    }

    if (allData.length === 0)
      return {
        /*
         * Instruct TypeScript typings that ContentMetadataClassifier.name is actualy a Classifier name we expect.
         * This is required for the bundlers to properly deduce the type of the classifier in data evaluation context.
         */
        [ContentMetadataClassifier.name as "ContentMetadataClassifier"]: {
          contentData: {}
        } satisfies TAvailableClassifiers["ContentMetadataClassifier"]
      };

    // Retrieve data for all enqueued content:
    const contentData = await this.retrieveData(data, allData);

    return {
      /*
       * Instruct TypeScript typings that ContentMetadataClassifier.name is actualy a Classifier name we expect.
       * This is required for the bundlers to properly deduce the type of the classifier in data evaluation context.
       */
      [ContentMetadataClassifier.name as "ContentMetadataClassifier"]: {
        contentData
      } satisfies TAvailableClassifiers["ContentMetadataClassifier"]
    };
  };
}
