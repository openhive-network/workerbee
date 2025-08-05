import { TAccountName, dateFromString } from "@hiveio/wax";
import { WorkerBeeError } from "../../../errors";
import { BucketAggregateQueue } from "../../../types/queue";
import { nullDate } from "../../../utils/time";
import { ContentMetadataClassifier } from "../../classifiers";
import { IHiveContentMetadata, TContentMetadataQueryData } from "../../classifiers/content-metadata-classifier";
import { TCollectorEvaluationContext } from "../../factories/data-evaluation-context";
import { CollectorBase, TAvailableClassifiers } from "../collector-base";

export const BUCKET_INTERVAL = 3 * 1000; // 3 seconds (Hive block interval)

const MAX_CONTENT_GET_LIMIT = 1000;

export class ContentMetadataCollector extends CollectorBase<ContentMetadataClassifier> {
  private readonly contractTimestamps = new BucketAggregateQueue<TContentMetadataQueryData>(BUCKET_INTERVAL);
  private readonly contentCached = new Set<string>();

  private async retrieveData(data: TCollectorEvaluationContext, requestData: TContentMetadataQueryData[]) {
    const contentData: Record<TAccountName, Record<string, IHiveContentMetadata>> = {};

    const nullPayoutAsset = this.worker.chain!.hiveCoins(0);

    const operationsPerAuthorPermlink = requestData.reduce((comms, comm) => {
      if (!comms[comm.author])
        comms[comm.author] = {};
      comms[comm.author][comm.permlink] = comm;

      return comms;
    }, {} as Record<string, Record<string, TContentMetadataQueryData>>);

    for (let i = 0; i < requestData.length; i += MAX_CONTENT_GET_LIMIT) {
      const chunk = requestData.slice(i, i + MAX_CONTENT_GET_LIMIT).map(({ author, permlink }) => ([author, permlink] as [TAccountName, string]));

      const apiCallStart = Date.now();
      const { cashout_infos } = await this.worker.chain!.api.database_api.get_comment_pending_payouts({ comments: chunk });
      data.addTiming("database_api.get_comment_pending_payouts", Date.now() - apiCallStart);

      const startCommentsAnalysis = Date.now();

      for(const info of cashout_infos) {
        contentData[info.author] = contentData[info.author] || {};

        const findMatchingCommentStart = Date.now();
        const matchingComment = operationsPerAuthorPermlink[info.author][info.permlink];
        if (!matchingComment)
          throw new WorkerBeeError(`Internal error: Content metadata for ${info.author}/${info.permlink} not found in operations`);

        data.addTiming("impactedAccount: findMatchingComment", Date.now() - findMatchingCommentStart);

        const cashoutInfo = info.cashout_info;

        const category = matchingComment.parent_author === "" ? matchingComment.parent_permlink: "";

        if (cashoutInfo !== undefined)
          contentData[info.author][info.permlink] = {
            author: info.author,
            permlink: info.permlink,
            parentAuthor: matchingComment.parent_author,
            parentPermlink: matchingComment.parent_permlink,
            category: category,
            title: matchingComment.title,
            allowsCurationRewards: cashoutInfo.allow_curation_rewards,
            allowsReplies: cashoutInfo.allow_replies,
            allowsVotes: cashoutInfo.allow_votes,
            authorRewards: BigInt(cashoutInfo.author_rewards),
            curatorPayoutValue: cashoutInfo.curator_payout_value,
            netRshares: BigInt(cashoutInfo.net_rshares),
            netVotes: cashoutInfo.net_votes,
            payoutTime: dateFromString(cashoutInfo.cashout_time),
            isPaid: false,
            totalPayoutValue: cashoutInfo.total_payout_value,
          };
        else
          contentData[info.author][info.permlink] = {
            author: info.author,
            permlink: info.permlink,
            parentAuthor: matchingComment.parent_author,
            parentPermlink: matchingComment.parent_permlink,
            category,
            title: matchingComment.title,
            allowsCurationRewards: false,
            allowsReplies: true,
            allowsVotes: true,
            authorRewards: BigInt(0),
            curatorPayoutValue: nullPayoutAsset,
            netRshares: BigInt(0),
            netVotes: 0,
            payoutTime: nullDate,
            isPaid: true,
            totalPayoutValue: nullPayoutAsset
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

          this.contractTimestamps.enqueue(rollbackAfter, {
            author,
            permlink,
            parent_author: postMetadata.parentAuthor,
            parent_permlink: postMetadata.parentPermlink,
            title: postMetadata.title
          });
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
