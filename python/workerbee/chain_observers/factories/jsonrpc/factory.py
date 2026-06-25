"""JsonRpcFactory — registers all 13 classifier→collector bindings for live mode.

Mirrors src/chain-observers/factories/jsonrpc/factory.ts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ...interfaces import IWorkerBee

from ...classifiers.account_classifier import AccountClassifier
from ...classifiers.block_classifier import BlockClassifier
from ...classifiers.block_header_classifier import BlockHeaderClassifier
from ...classifiers.change_recovery_in_progress_classifier import ChangeRecoveryInProgressClassifier
from ...classifiers.content_metadata_classifier import ContentMetadataClassifier
from ...classifiers.decline_voting_rights_classifier import DeclineVotingRightsClassifier
from ...classifiers.dynamic_global_properties_classifier import DynamicGlobalPropertiesClassifier
from ...classifiers.feed_price_classifier import FeedPriceClassifier
from ...classifiers.impacted_account_classifier import ImpactedAccountClassifier
from ...classifiers.manabar_classifier import ManabarClassifier
from ...classifiers.operation_classifier import OperationClassifier
from ...classifiers.rc_account_classifier import RcAccountClassifier
from ...classifiers.witness_classifier import WitnessClassifier
from ...collectors.common.block_header_collector import BlockHeaderCollector
from ...collectors.common.impacted_account_collector import ImpactedAccountCollector
from ...collectors.common.manabar_collector import ManabarCollector
from ...collectors.common.operation_collector import OperationCollector
from ...collectors.jsonrpc.account_collector import AccountCollector
from ...collectors.jsonrpc.block_collector import BlockCollector
from ...collectors.jsonrpc.change_recovery_in_progress_collector import ChangeRecoveryInProgressCollector
from ...collectors.jsonrpc.content_metadata_collector import ContentMetadataCollector
from ...collectors.jsonrpc.decline_voting_rights_collector import DeclineVotingRightsCollector
from ...collectors.jsonrpc.dynamic_global_properties_collector import DynamicGlobalPropertiesCollector
from ...collectors.jsonrpc.feed_price_collector import FeedPriceCollector
from ...collectors.jsonrpc.rc_account_collector import RcAccountCollector
from ...collectors.jsonrpc.witness_collector import WitnessCollector
from ..factory_base import EClassifierOrigin, FactoryBase


class JsonRpcFactory(FactoryBase):
    def __init__(self, worker: IWorkerBee) -> None:
        super().__init__(worker)

        self.register_classifier(BlockHeaderClassifier, BlockHeaderCollector, worker)
        self.register_classifier(DynamicGlobalPropertiesClassifier, DynamicGlobalPropertiesCollector, worker)
        self.register_classifier(BlockClassifier, BlockCollector, worker)
        self.register_classifier(AccountClassifier, AccountCollector, worker)
        self.register_classifier(RcAccountClassifier, RcAccountCollector, worker)
        self.register_classifier(ImpactedAccountClassifier, ImpactedAccountCollector, worker)
        self.register_classifier(OperationClassifier, OperationCollector, worker)
        self.register_classifier(FeedPriceClassifier, FeedPriceCollector, worker)
        self.register_classifier(WitnessClassifier, WitnessCollector, worker)
        self.register_classifier(ChangeRecoveryInProgressClassifier, ChangeRecoveryInProgressCollector, worker)
        self.register_classifier(DeclineVotingRightsClassifier, DeclineVotingRightsCollector, worker)
        self.register_classifier(ManabarClassifier, ManabarCollector, worker)
        self.register_classifier(ContentMetadataClassifier, ContentMetadataCollector, worker)

        self.push_classifier(DynamicGlobalPropertiesClassifier, EClassifierOrigin.FACTORY)
