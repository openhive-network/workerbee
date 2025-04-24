import { WorkerBee } from "../../../bot";
import { DynamicGlobalPropertiesClassifier } from "../../classifiers";
import { ObserverMediator } from "../../observer-mediator";
import { DataEvaluationContext } from "../data-evaluation-context";
import { EClassifierOrigin, FactoryBase } from "../factory-base";
import { HistoryDataFactoryData } from "./factory-data";

export class HistoryDataFactory extends FactoryBase {
  private hasDGPOClassifier = false;
  private previousBlockNumber?: number;

  public constructor(
    worker: WorkerBee,
    public readonly fromBlock: number,
    public readonly toBlock?: number
  ) {
    super(worker);

    this.collectors = new Map(HistoryDataFactoryData(worker, fromBlock, toBlock));
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
