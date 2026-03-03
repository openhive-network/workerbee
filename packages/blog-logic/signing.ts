/**
 * Transaction signing interfaces for blog-logic
 *
 * This module provides a runtime-agnostic abstraction for signing Hive blockchain
 * transactions. Implementations exist for:
 * - Browser: Keychain, hb-auth, WIF (in-memory)
 * - Node.js: Beekeeper
 */

import type { ITransaction, TAccountName } from "@hiveio/wax";

/**
 * Permission level required for signing operations
 * - posting: votes, comments, follows, reblogs
 * - active: transfers, power ups/downs, witness votes
 * - owner: account recovery, key changes (rarely used)
 */
export type PermissionLevel = "posting" | "active" | "owner";

/**
 * Abstract interface for transaction signing.
 *
 * Implementations handle all complexity of the signing process:
 * - Keychain: opens browser popup, waits for user approval
 * - hb-auth: may trigger password dialog if session expired
 * - WIF: signs immediately with in-memory key
 * - Beekeeper: signs with unlocked wallet (Node.js)
 *
 * @example
 * ```typescript
 * // Browser with Keychain
 * const signer = new KeychainSigner("username", "posting");
 * await signer.sign(tx);
 *
 * // Node.js with Beekeeper
 * const signer = await BeekeeperSigner.create(wallet, "username", "posting", chain);
 * await signer.sign(tx);
 * ```
 */
export interface ITransactionSigner {
  /**
   * Sign a transaction.
   *
   * The implementation may be synchronous (WIF) or involve async UI flows
   * (Keychain popup, hb-auth password dialog). The returned transaction
   * will have the signature added.
   *
   * @param tx - The transaction to sign (will be mutated with signature)
   * @returns The signed transaction (same instance, with signature added)
   *
   * @throws SigningCancelledError - User rejected or cancelled the signing request
   * @throws SigningTimeoutError - User didn't respond within the timeout period
   * @throws SessionExpiredError - Authentication session expired, re-auth required
   * @throws SigningError - Other signing failures (extension not installed, etc.)
   */
  sign(tx: ITransaction): Promise<ITransaction>;

  /**
   * The account name this signer is configured for
   */
  readonly account: TAccountName;

  /**
   * The permission level this signer can sign with
   */
  readonly permissionLevel: PermissionLevel;
}

/*
 * ============================================================================
 * Signing Errors
 * ============================================================================
 */

/**
 * Base error class for all signing-related errors
 */
export class SigningError extends Error {
  public readonly name = "SigningError";

  public constructor(message: string, public readonly cause?: Error | unknown) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the user explicitly cancels or rejects the signing request.
 * This is not an error condition - the UI should handle this gracefully.
 */
export class SigningCancelledError extends SigningError {
  public readonly name = "SigningCancelledError";

  public constructor(message = "User cancelled the signing request") {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the signing request times out waiting for user response.
 * Common with Keychain when user ignores the popup.
 */
export class SigningTimeoutError extends SigningError {
  public readonly name = "SigningTimeoutError";

  public constructor(
    message = "Signing request timed out",
    public readonly timeoutMs?: number
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the authentication session has expired and re-authentication
 * is required before signing can proceed.
 *
 * For hb-auth: session timeout (default 15min) or password cache expired (4hr)
 * For Beekeeper: wallet was locked
 */
export class SessionExpiredError extends SigningError {
  public readonly name = "SessionExpiredError";

  public constructor(message = "Authentication session expired, please sign in again") {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the signing method is not available in the current environment.
 * For example, Keychain extension not installed in browser.
 */
export class SignerNotAvailableError extends SigningError {
  public readonly name = "SignerNotAvailableError";

  public constructor(
    public readonly signerType: string,
    message?: string
  ) {
    super(message ?? `${signerType} is not available`);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when attempting to sign with a permission level that is not
 * allowed for the current signing method.
 *
 * For example, WIF signing may be restricted to posting key only for security.
 */
export class PermissionDeniedError extends SigningError {
  public readonly name = "PermissionDeniedError";

  public constructor(
    public readonly requiredPermission: PermissionLevel,
    public readonly signerType: string,
    message?: string
  ) {
    super(
      message ??
        `${signerType} does not allow ${requiredPermission} key operations`
    );
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
