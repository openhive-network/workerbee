import { IVote } from "./interfaces";
import { VoteData } from "./wax";

export class Vote implements IVote {
  public upvote: boolean;
  public voter: string;
  public weight: number;

  public constructor(voteData: VoteData) {
    this.upvote = voteData.weight > 0;
    this.voter = voteData.voter;
    this.weight = voteData.weight;
  }
}
