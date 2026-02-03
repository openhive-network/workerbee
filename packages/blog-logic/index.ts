// Blog Logic - Hive blockchain blogging library

export { DataProvider } from "./DataProvider";
export { BloggingPlatform } from "./BloggingPlatform";
export { Post } from "./Post";
export { Comment } from "./Comment";
export { Reply } from "./Reply";
export { Account } from "./Account";
export { Community } from "./Community";
export { Vote } from "./Vote";
export { getWax, resetWax, configureEndpoints, withRetry } from "./wax";
export type { WaxExtendedChain } from "./wax";
export { WorkerBeeError } from "./errors";

// Re-export interfaces
export type {
  IPagination,
  ICommonFilters,
  IVotesFilters,
  IPostFilters,
  IAccountPostsFilters,
  AccountPostsSortOption,
  ICommunityFilters,
  IAccountIdentity,
  ICommunityIdentity,
  IPostCommentIdentity,
  IVote,
  ICommunity,
  IAccount,
  IAccountManabars,
  IManabar,
  IComment,
  IReply,
  IPost,
  IBloggingPlatform,
  ILoginSession,
  IAuthenticationProvider,
  IActiveBloggingPlatform,
  // Profile/account/global data types
  IProfile,
  IProfileStats,
  IProfileMetadata,
  IProfileMetadataJson,
  IDatabaseAccount,
  IGlobalProperties,
  IFullUserData,
  CommentSortOption,
  IPaginationCursor,
  IPaginatedResult,
  // NaiAsset type from wax
  NaiAsset,
  // Observer interface for callbacks
  Observer,
} from "./interfaces";

// Re-export utilities
export {
  paginateData,
  // Wax-based asset utilities (require chain instance)
  parseAssetWithChain,
  formatAsset,
  getAssetAmount,
  getAssetSymbol,
  vestsToHpAsset,
  vestsToHpNumber,
  calculateEffectiveHpAsset,
  calculateEffectiveHpNumber,
  // Standalone asset utilities (no chain required)
  parseNaiAsset,
  parseFormattedAsset,
  stripAssetSuffix,
  convertVestsToHP,
  calculateEffectiveHP,
  // Display formatting utilities
  formatCompactNumber,
  formatNumber,
  formatJoinDate,
  formatReputation,
} from "./utils";

// Re-export PostBridgeApi type from wax-api-jsonrpc for post/comment data
export type { PostBridgeApi as BridgeComment, PostBridgeApi as BridgePost } from "@hiveio/wax-api-jsonrpc";
