import type { WorkerBee } from "../../../bot";
import {
  AccountClassifier, BlockClassifier, BlockHeaderClassifier,
  ChangeRecoveryInProgressClassifier,
  DeclineVotingRightsClassifier,
  DynamicGlobalPropertiesClassifier, FeedPriceClassifier, ImpactedAccountClassifier, ManabarClassifier, OperationClassifier, RcAccountClassifier,
  WitnessClassifier
} from "../../classifiers";
import { IEvaluationContextClass } from "../../classifiers/collector-classifier-base";
import { CollectorBase } from "../../collectors/collector-base";
import { BlockHeaderCollector } from "../../collectors/common/block-header-collector";
import { ImpactedAccountCollector } from "../../collectors/common/impacted-account-collector";
import { ManabarCollector } from "../../collectors/common/manabar-collector";
import { OperationCollector } from "../../collectors/common/operation-collector";
import { AccountCollector } from "../../collectors/jsonrpc/account-collector";
import { BlockCollector } from "../../collectors/jsonrpc/block-collector";
import { ChangeRecoveryInProgressCollector } from "../../collectors/jsonrpc/change-recovery-in-progress-collector";
import { DeclineVotingRightsCollector } from "../../collectors/jsonrpc/decline-voting-rights-collector";
import { DynamicGlobalPropertiesCollector } from "../../collectors/jsonrpc/dynamic-global-properties-collector";
import { FeedPriceCollector } from "../../collectors/jsonrpc/feed-price-collector";
import { RcAccountCollector } from "../../collectors/jsonrpc/rc-account-collector";
import { WitnessCollector } from "../../collectors/jsonrpc/witness-collector";

export const JsonRpcFactoryData: (worker: WorkerBee) => Array<[IEvaluationContextClass, CollectorBase]> = (worker: WorkerBee) => ([
  [BlockHeaderClassifier, new BlockHeaderCollector(worker)],
  [DynamicGlobalPropertiesClassifier, new DynamicGlobalPropertiesCollector(worker)],
  [BlockClassifier, new BlockCollector(worker)],
  [AccountClassifier, new AccountCollector(worker)],
  [RcAccountClassifier, new RcAccountCollector(worker)],
  [ImpactedAccountClassifier, new ImpactedAccountCollector(worker)],
  [OperationClassifier, new OperationCollector(worker)],
  [FeedPriceClassifier, new FeedPriceCollector(worker)],
  [WitnessClassifier, new WitnessCollector(worker)],
  [ChangeRecoveryInProgressClassifier, new ChangeRecoveryInProgressCollector(worker)],
  [DeclineVotingRightsClassifier, new DeclineVotingRightsCollector(worker)],
  [ManabarClassifier, new ManabarCollector(worker)],
]);
