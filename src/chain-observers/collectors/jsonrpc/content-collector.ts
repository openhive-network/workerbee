import { TAccountName } from "@hiveio/wax";
import Long from "long";
import { OrderedQueue } from "../../../types/queue";
import { ContentClassifier, IHiveContent } from "../../classifiers/content-classifier";
import { DataEvaluationContext } from "../../factories/data-evaluation-context";
import { CollectorBase, TAvailableClassifiers } from "../collector-base";

export const BUCKET_INTERVAL = 3 * 1000; // 3 seconds (Hive block interval)

export interface IContentCollectorOptions {
  account: string;
  permlink: string;
  rollbackContractAfter: Date;
}

export type TContentContractData = [TAccountName, string];

const MAX_CONTENT_GET_LIMIT = 1000;

export class ContentCollector extends CollectorBase {
  private readonly contractTimestamps = new OrderedQueue<number, TContentContractData>();
  private readonly contentCached = new Set<string>();

  protected pushOptions(data: IContentCollectorOptions): void {
    const permlink = `${data.account}/${data.permlink}`;

    const rollbackAfter = Math.floor(data.rollbackContractAfter.getTime());
    const bucketInterval = rollbackAfter + (BUCKET_INTERVAL - (rollbackAfter % BUCKET_INTERVAL));

    if (this.contentCached.has(permlink))
      // If we already have this content, we don't need to enqueue it again
      return;

    this.contractTimestamps.enqueue(bucketInterval, [data.account, data.permlink]);
    this.contentCached.add(permlink);
  }

  // Data is automatically managed and popped from the queue
  protected popOptions(_data: IContentCollectorOptions): void {}

  public async fetchData(data: DataEvaluationContext) {
    const contentData: Record<TAccountName, Record<string, IHiveContent>> = {};

    const allData: Array<[TAccountName, string]> = [];

    const currentTime = Date.now();
    for(const { value } of this.contractTimestamps.dequeueUntil(currentTime)) {
      for(const apiData of value)
        allData.push(apiData);

      // Cleanup
      this.contentCached.delete(`${value[0]}/${value[1]}`);
    }

    for (let i = 0; i < allData.length; i += MAX_CONTENT_GET_LIMIT) {
      const chunk = allData.slice(i, i + MAX_CONTENT_GET_LIMIT);

      const startFindComments = Date.now();
      const { comments } = await this.worker.chain!.api.database_api.find_comments({ comments: chunk });
      data.addTiming("database_api.find_comments", Date.now() - startFindComments);

      const startCommentsAnalysis = Date.now();

      for(const comment of comments) {
        contentData[comment.author] = contentData[comment.author] || {};
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
          payoutTime: new Date(`${comment.last_payout}Z`),
          replyCount: comment.children,
          totalPayoutValue: comment.total_payout_value,
          title: comment.title
        };
      }

      data.addTiming("commentsAnalysis", Date.now() - startCommentsAnalysis);
    }

    return {
      [ContentClassifier.name]: {
        contentData
      } as TAvailableClassifiers["ContentClassifier"],
    } satisfies Partial<TAvailableClassifiers>;
  };
}
