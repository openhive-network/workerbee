import { WorkerBee } from "../../../bot";
import {
  BlockClassifier, BlockHeaderClassifier, ContentMetadataClassifier,
  DynamicGlobalPropertiesClassifier, ImpactedAccountClassifier, OperationClassifier
} from "../../classifiers";
import { ImpactedAccountCollector } from "../../collectors/common/impacted-account-collector";
import { OperationCollector } from "../../collectors/common/operation-collector";
import { BlockCollector } from "../../collectors/historydata/block-collector";
import { DynamicGlobalPropertiesCollector } from "../../collectors/historydata/dynamic-global-properties-collector";
import { ContentMetadataCollector } from "../../collectors/jsonrpc/content-metadata-collector";
import { ObserverMediator } from "../../observer-mediator";
import { DataEvaluationContext } from "../data-evaluation-context";
import { EClassifierOrigin, FactoryBase } from "../factory-base";

export class HistoryDataFactory extends FactoryBase {
  public readonly fromBlock: number;
  public readonly toBlock?: number;

  public constructor(
    worker: WorkerBee,
    fromBlock: number,
    toBlock?: number
  ) {
    super(worker);

    this.fromBlock = fromBlock;
    this.toBlock = toBlock;

    super.registerClassifier(BlockHeaderClassifier, BlockCollector, worker, fromBlock, toBlock);
    super.registerClassifier(DynamicGlobalPropertiesClassifier, DynamicGlobalPropertiesCollector, worker);
    super.registerClassifier(BlockClassifier, BlockCollector, worker, fromBlock, toBlock);
    super.registerClassifier(ImpactedAccountClassifier, ImpactedAccountCollector, worker);
    super.registerClassifier(OperationClassifier, OperationCollector, worker);
    // This is intended use of JSON-RPC collector for content metadata as there may be future payouts in past content:
    super.registerClassifier(ContentMetadataClassifier, ContentMetadataCollector, worker);

    // We have to push classifier after registering its implementation as collector. Maybe this should be handled internally?
    super.pushClassifier(DynamicGlobalPropertiesClassifier, EClassifierOrigin.FACTORY);
  }

  public async preNotify(context: DataEvaluationContext, mediator: ObserverMediator): Promise<boolean> {
    const blockChanged = await super.preNotify(context, mediator);

    if (!blockChanged) {
      mediator.unregisterAllListeners();

      return false;
    }

    return true;
  }

  public async postNotify(context: DataEvaluationContext, mediator: ObserverMediator): Promise<void> {
    await super.postNotify(context, mediator);

    if (this.toBlock && this.currentBlockNumber! >= this.toBlock)
      mediator.unregisterAllListeners();
    else
      void mediator.notify();
  }
}
