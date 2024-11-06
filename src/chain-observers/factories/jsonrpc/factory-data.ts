import type { WorkerBee } from "../../../bot";
import {
  AccountClassifier, BlockClassifier, BlockHeaderClassifier,
  DynamicGlobalPropertiesClassifier, ImpactedAccountClassifier, OperationClassifier, RcAccountClassifier
} from "../../classifiers";
import { IEvaluationContextClass } from "../../classifiers/collector-classifier-base";
import { CollectorBase } from "../../collectors/collector-base";
import { BlockHeaderCollector } from "../../collectors/common/block-header-collector";
import { ImpactedAccountCollector } from "../../collectors/common/impacted-account-collector";
import { OperationCollector } from "../../collectors/common/operation-collector";
import { AccountCollector } from "../../collectors/jsonrpc/account-collector";
import { BlockCollector } from "../../collectors/jsonrpc/block-collector";
import { DynamicGlobalPropertiesCollector } from "../../collectors/jsonrpc/dynamic-global-properties-collector";
import { RcAccountCollector } from "../../collectors/jsonrpc/rc-account-collector";

export const JsonRpcFactoryData: (worker: WorkerBee) => Array<[IEvaluationContextClass, CollectorBase]> = (worker: WorkerBee) => ([
  [BlockHeaderClassifier, new BlockHeaderCollector(worker)],
  [DynamicGlobalPropertiesClassifier, new DynamicGlobalPropertiesCollector(worker)],
  [BlockClassifier, new BlockCollector(worker)],
  [AccountClassifier, new AccountCollector(worker)],
  [RcAccountClassifier, new RcAccountCollector(worker)],
  [ImpactedAccountClassifier, new ImpactedAccountCollector(worker)],
  [OperationClassifier, new OperationCollector(worker)]
]);
