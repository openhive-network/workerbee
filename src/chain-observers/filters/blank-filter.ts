import type { WorkerBee } from "../../bot";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { FilterBase } from "./filter-base";

export class BlankFilter extends FilterBase {
  public constructor(
    worker: WorkerBee
  ) {
    super(worker);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [];
  }

  /* eslint-disable-next-line require-await */
  public async match(): Promise<boolean> {
    return true;
  }
}
