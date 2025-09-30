import { IVote } from "./interfaces";
import { IVoteListItem } from "./wax";

export class Vote implements IVote {
  public upvote: boolean;
  public voter: string;
  public weight: number;

  public constructor(voteData: IVoteListItem) {
    this.upvote = Number(voteData.weight) > 0
    this.voter = voteData.voter;
    this.weight = Number(voteData.weight);
  }
}
