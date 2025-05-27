import type { WorkerBee } from "../../../bot";
import {
  BlockClassifier, BlockHeaderClassifier,
  DynamicGlobalPropertiesClassifier, ImpactedAccountClassifier, OperationClassifier
} from "../../classifiers";
import { CollectorClassifierBase, IEvaluationContextClass } from "../../classifiers/collector-classifier-base";
import { CollectorBase } from "../../collectors/collector-base";
import { ImpactedAccountCollector } from "../../collectors/common/impacted-account-collector";
import { OperationCollector } from "../../collectors/common/operation-collector";
import { BlockCollector } from "../../collectors/historydata/block-collector";
import { DynamicGlobalPropertiesCollector } from "../../collectors/historydata/dynamic-global-properties-collector";

export const HistoryDataFactoryData = (worker: WorkerBee, fromBlock: number, toBlock?: number):
  Array<[IEvaluationContextClass, CollectorBase<CollectorClassifierBase<any, any, any, any>>]> => {
  const blockClassifier = new BlockCollector(worker, fromBlock, toBlock);

  return [
    [BlockHeaderClassifier, blockClassifier],
    [DynamicGlobalPropertiesClassifier, new DynamicGlobalPropertiesCollector(worker)],
    [BlockClassifier, blockClassifier],
    [ImpactedAccountClassifier, new ImpactedAccountCollector(worker)],
    [OperationClassifier, new OperationCollector(worker)],
  ];
};
