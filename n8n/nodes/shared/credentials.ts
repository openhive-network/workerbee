/**
 * Resolving which Hive node to talk to.
 *
 * Precedence, most specific first: the per-subscription/per-item `endpoint`
 * override, then the `hiveApi` credential, then the public default. The
 * credential is optional, so a freshly dropped node works with no setup at all
 * -- which is the difference between "the extension is installed" and "the
 * extension does something".
 */
import { DEFAULT_ENDPOINT, normalizeEndpoint } from "./chain";
import { CredentialError } from "./errors";

export const HIVE_CREDENTIALS = "hiveApi";

interface ICredentialReader {
  getCredentials<T extends object>(type: string): Promise<T>;
  getNode(): { credentials?: Record<string, unknown> };
}

/**
 * The chain id the credential names, if any.
 *
 * Empty means Hive mainnet, which is wax's default. It matters only where
 * something is signed; every read works without it.
 */
export async function resolveChainId(context: ICredentialReader): Promise<string | undefined> {
  if (context.getNode().credentials?.[HIVE_CREDENTIALS] === undefined) return undefined;
  const credentials = await context.getCredentials<{ chainId?: string }>(HIVE_CREDENTIALS);
  const chainId = (credentials.chainId ?? "").trim();
  return chainId === "" ? undefined : chainId;
}

export async function resolveEndpoint(context: ICredentialReader, override?: string): Promise<string> {
  const explicit = (override ?? "").trim();
  if (explicit !== "") return normalizeEndpoint(explicit);

  /*
   * No credential attached at all: n8n throws rather than returning undefined,
   * and an unconfigured node is a supported way to use this package.
   */
  if (context.getNode().credentials?.[HIVE_CREDENTIALS] === undefined) return DEFAULT_ENDPOINT;

  try {
    const credentials = await context.getCredentials<{ endpoint?: string }>(HIVE_CREDENTIALS);
    return normalizeEndpoint(credentials.endpoint);
  } catch (error) {
    /*
     * A credential *is* configured and could not be read -- deleted, renamed, or
     * undecryptable. Falling back here would be the worst possible guess: a node
     * pointed at a testnet or a private API would silently reattach to public
     * mainnet and start acting on real events.
     *
     * Its own class, not UpstreamError: the boundary maps every UpstreamError to
     * a NodeApiError, which would blame the Hive node for a fault that is
     * entirely on this side.
     */
    throw new CredentialError("The Hive API credential could not be read", (error as Error).message, error);
  }
}
