import type { WorkerBee } from "../../bot";
import { DynamicGlobalPropertiesClassifier, RcAccountClassifier } from "../classifiers";
import type { TRegisterEvaluationContext } from "../classifiers/collector-classifier-base";
import { IRcAccountCollectorOptions } from "../collectors/jsonrpc/rc-account-collector";
import type { DataEvaluationContext } from "../factories/data-evaluation-context";
import { FilterBase } from "./filter-base";

export class AccountFullManabarFilter extends FilterBase {
  public constructor(
    worker: WorkerBee,
    private readonly account: string
  ) {
    super(worker);
  }

  public usedContexts(): Array<TRegisterEvaluationContext> {
    return [
      DynamicGlobalPropertiesClassifier,
      RcAccountClassifier.forOptions({ rcAccount: this.account } satisfies IRcAccountCollectorOptions)
    ];
  }

  public async match(data: DataEvaluationContext): Promise<boolean> {
    const rcAccountClassifier = await data.get(RcAccountClassifier);
    const dgpo = await data.get(DynamicGlobalPropertiesClassifier);

    const rcAccount = rcAccountClassifier.rcAccounts[this.account];

    const manabarData = this.worker.chain!.calculateCurrentManabarValue(
      Math.round(dgpo.headBlockTime.getTime() / 1000),
      rcAccount.maxRc,
      rcAccount.manabar.currentMana,
      rcAccount.manabar.lastUpdateTime.getTime() / 1000
    );

    return manabarData.percent >= 98;
  }
}
