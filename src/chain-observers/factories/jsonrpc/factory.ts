import { WorkerBee } from "../../../bot";
import {
  AccountClassifier, BlockClassifier, BlockHeaderClassifier, ChangeRecoveryInProgressClassifier,
  ContentMetadataClassifier, DeclineVotingRightsClassifier, DynamicGlobalPropertiesClassifier, FeedPriceClassifier,
  ImpactedAccountClassifier, ManabarClassifier, OperationClassifier, RcAccountClassifier, WitnessClassifier
} from "../../classifiers";
import { BlockHeaderCollector } from "../../collectors/common/block-header-collector";
import { ImpactedAccountCollector } from "../../collectors/common/impacted-account-collector";
import { ManabarCollector } from "../../collectors/common/manabar-collector";
import { OperationCollector } from "../../collectors/common/operation-collector";
import { AccountCollector } from "../../collectors/jsonrpc/account-collector";
import { BlockCollector } from "../../collectors/jsonrpc/block-collector";
import { ChangeRecoveryInProgressCollector } from "../../collectors/jsonrpc/change-recovery-in-progress-collector";
import { ContentMetadataCollector } from "../../collectors/jsonrpc/content-metadata-collector";
import { DeclineVotingRightsCollector } from "../../collectors/jsonrpc/decline-voting-rights-collector";
import { DynamicGlobalPropertiesCollector } from "../../collectors/jsonrpc/dynamic-global-properties-collector";
import { FeedPriceCollector } from "../../collectors/jsonrpc/feed-price-collector";
import { RcAccountCollector } from "../../collectors/jsonrpc/rc-account-collector";
import { WitnessCollector } from "../../collectors/jsonrpc/witness-collector";
import { EClassifierOrigin, FactoryBase } from "../factory-base";

export class JsonRpcFactory extends FactoryBase {
  public constructor(
    protected readonly worker: WorkerBee
  ) {
    super(worker);

    super.registerClassifier(BlockHeaderClassifier, BlockHeaderCollector, worker);
    super.registerClassifier(DynamicGlobalPropertiesClassifier, DynamicGlobalPropertiesCollector, worker);
    super.registerClassifier(BlockClassifier, BlockCollector, worker);
    super.registerClassifier(AccountClassifier, AccountCollector, worker);
    super.registerClassifier(RcAccountClassifier, RcAccountCollector, worker);
    super.registerClassifier(ImpactedAccountClassifier, ImpactedAccountCollector, worker);
    super.registerClassifier(OperationClassifier, OperationCollector, worker);
    super.registerClassifier(FeedPriceClassifier, FeedPriceCollector, worker);
    super.registerClassifier(WitnessClassifier, WitnessCollector, worker);
    super.registerClassifier(ChangeRecoveryInProgressClassifier, ChangeRecoveryInProgressCollector, worker);
    super.registerClassifier(DeclineVotingRightsClassifier, DeclineVotingRightsCollector, worker);
    super.registerClassifier(ManabarClassifier, ManabarCollector, worker);
    super.registerClassifier(ContentMetadataClassifier, ContentMetadataCollector, worker);

    super.pushClassifier(DynamicGlobalPropertiesClassifier, EClassifierOrigin.FACTORY);
  }
}
