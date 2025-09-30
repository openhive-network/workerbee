import { TWaxExtended, TWaxRestExtended } from "@hiveio/wax";
import { BloggingPlaform } from "./BloggingPlatform";
import { ExtendedNodeApi, ExtendedRestApi } from "./wax";

export class DataProvider {
  public chain: TWaxExtended<ExtendedNodeApi, TWaxRestExtended<ExtendedRestApi>>;
  public bloggingPlatform: BloggingPlaform;

  public constructor(chain: TWaxExtended<ExtendedNodeApi, TWaxRestExtended<ExtendedRestApi>>) {
    this.chain = chain;
    this.bloggingPlatform = new BloggingPlaform(this);
  }
}
