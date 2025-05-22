import { TAccountName } from "@hiveio/wax";
import Long from "long";
import { WorkerBee } from "../../../bot";
import { ContentClassifier, IHiveContent } from "../../classifiers/content-classifier";
import { DataEvaluationContext } from "../../factories/data-evaluation-context";
import { CollectorBase, TAvailableClassifiers } from "../collector-base";

export interface IContentCollectorOptions {
  account: string;
  permlink: string;
  rollbackContractAfter: Date;
}

export interface IContentContractData {
  apiData: [TAccountName, string];
  count: number;
  rollbackContractAfter: Date;
}

const MAX_CONTENT_GET_LIMIT = 1000;

export class ContentCollector extends CollectorBase {
  private readonly permlinks = new Map<string, IContentContractData>();

  public constructor(
    protected readonly worker: WorkerBee,
    private readonly expireImmediately: boolean = false
  ) {
    super(worker);
  }

  protected pushOptions(data: IContentCollectorOptions): void {
    const permlink = `${data.account}/${data.permlink}`;
    let permlinkData = this.permlinks.get(permlink);

    if (!permlinkData)
      permlinkData = {
        apiData: [data.account, data.permlink],
        count: 0,
        rollbackContractAfter: data.rollbackContractAfter
      };


    this.permlinks.set(permlink, {
      apiData: permlinkData.apiData,
      count: permlinkData.count + 1,
      rollbackContractAfter: data.rollbackContractAfter > permlinkData.rollbackContractAfter
        ? data.rollbackContractAfter
        : permlinkData.rollbackContractAfter
    });
  }

  protected popOptions(data: IContentCollectorOptions): void {
    const permlink = `${data.account}/${data.permlink}`;
    const permlinkData = this.permlinks.get(permlink);

    if (permlinkData)
      if (permlinkData.count > 1)
        this.permlinks.set(permlink, {
          apiData: permlinkData.apiData,
          count: permlinkData.count - 1,
          rollbackContractAfter: permlinkData.rollbackContractAfter
        });
      else
        this.permlinks.delete(permlink);
  }

  public async fetchData(data: DataEvaluationContext) {
    const contentData: Record<TAccountName, Record<string, IHiveContent>> = {};

    const allData: Array<[TAccountName, string]> = [];

    const currentTime = new Date();
    for(const { rollbackContractAfter, apiData } of this.permlinks.values())
      if (currentTime > rollbackContractAfter)
        this.permlinks.delete(`${apiData[0]}/${apiData[1]}`);
      else {
        allData.push(apiData);

        if (this.expireImmediately)
          this.permlinks.delete(`${apiData[0]}/${apiData[1]}`);
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
