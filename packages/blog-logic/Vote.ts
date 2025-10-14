import { WorkerBeeError } from "../../src/errors";
import { DataProvider } from "./DataProvider";
import { IPostCommentIdentity, IVote } from "./interfaces";

export class Vote implements IVote {
  public parentComment: IPostCommentIdentity;
  public upvote: boolean;
  public voter: string;
  public weight: number;

  public constructor(parentId: IPostCommentIdentity, voter: string, dataProvider: DataProvider) {
    const voteData = dataProvider.getVote(parentId, voter);
    if(!voteData) throw new WorkerBeeError("No account");
    this.upvote = Number(voteData.weight) > 0
    this.voter = voteData.voter;
    this.weight = Number(voteData.weight);
    this.parentComment = {author: voteData.author, permlink: voteData.permlink};
  }
}
