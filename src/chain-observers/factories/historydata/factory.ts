import { WorkerBee } from "../../../bot";
import { BlockClassifier, BlockHeaderClassifier, DynamicGlobalPropertiesClassifier, ImpactedAccountClassifier, OperationClassifier } from "../../classifiers";
import { ImpactedAccountCollector } from "../../collectors/common/impacted-account-collector";
import { OperationCollector } from "../../collectors/common/operation-collector";
import { BlockCollector } from "../../collectors/historydata/block-collector";
import { DynamicGlobalPropertiesCollector } from "../../collectors/historydata/dynamic-global-properties-collector";
import { ObserverMediator } from "../../observer-mediator";
import { DataEvaluationContext } from "../data-evaluation-context";
import { EClassifierOrigin, FactoryBase } from "../factory-base";

export class HistoryDataFactory extends FactoryBase {
  private hasDGPOClassifier = false;
  private previousBlockNumber?: number;

  public constructor(
    worker: WorkerBee,
    public readonly fromBlock: number,
    public readonly toBlock?: number
  ) {
    super(worker);

    super.registerClassifier(BlockHeaderClassifier, BlockCollector, worker, fromBlock, toBlock);
    super.registerClassifier(DynamicGlobalPropertiesClassifier, DynamicGlobalPropertiesCollector, worker);
    super.registerClassifier(BlockClassifier, BlockCollector, worker, fromBlock, toBlock);
    super.registerClassifier(ImpactedAccountClassifier, ImpactedAccountCollector, worker);
    super.registerClassifier(OperationClassifier, OperationCollector, worker);
  }

  public preNotify(): void {
    // Ensure we have DGPO classifier
    if (this.hasDGPOClassifier)
      return;

    this.pushClassifier(DynamicGlobalPropertiesClassifier, EClassifierOrigin.FACTORY);
    this.hasDGPOClassifier = true;
  }

  public postNotify(mediator: ObserverMediator, context: DataEvaluationContext): void {
    context.get(DynamicGlobalPropertiesClassifier).then(dgp => {
      if (this.toBlock && dgp.headBlockNumber >= this.toBlock)
        mediator.unregisterAllListeners();
      else if (!this.toBlock && dgp?.headBlockNumber === this.previousBlockNumber)
        mediator.unregisterAllListeners();
      else
        mediator.notify();

      this.previousBlockNumber = dgp.headBlockNumber;
    });
  }
}
