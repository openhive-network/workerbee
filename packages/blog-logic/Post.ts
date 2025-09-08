import { IPagination, IPost, IPostCommentIdentity, IPostCommentsFilters, IReply } from "./interfaces";


export class Post implements IPost { 

  constructor(AuthorPermlink: IPostCommentIdentity) {
    // Use getPost method to load all data
  }

  public generateSlug(): string {
    return `${this.author.name}_${this.permlink}`;
  }

  public enumReplies(filter: IPostCommentsFilters, pagination: IPagination): Iterable<IReply> {
    
  }
}