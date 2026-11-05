import { FilterBase } from "./filter-base";

export class BlankFilter extends FilterBase {
  /* eslint-disable-next-line require-await */
  public async match(): Promise<boolean> {
    return true;
  }
}
