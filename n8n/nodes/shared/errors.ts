/**
 * Error types carrying a stable, machine-readable `code`.
 *
 * The node surfaces `message` to the user; `code` is what a workflow can branch
 * on with an Error Trigger, without parsing prose. These classes never leave a
 * node as they are: `node-errors.ts` translates them at the boundary into the
 * `NodeOperationError` / `NodeApiError` that n8n can classify.
 *
 * The `code` survives that translation as the error's `type` for every class
 * except {@link UpstreamError}, which becomes a `NodeApiError` -- and that has
 * no `type` field to carry one. For an endpoint failure the *class* is the
 * signal; see the note in `node-errors.ts`.
 */

export class HiveNodeError extends Error {
  /**
   * The message without the detail appended.
   *
   * `message` carries both, so a bare `console.error` says everything. n8n splits
   * them instead -- title and description -- and giving it the joined message as
   * the title would print the detail twice, once in each half.
   */
  public readonly headline: string;

  public constructor(
    message: string,
    public readonly code: string,
    public readonly detail?: string,
    /**
     * The error this one was raised from, kept the way `WorkerBeeError` keeps
     * it. Without it the original stack is lost at the first boundary, and all
     * that survives is a message somebody else wrote.
     */
    originator?: unknown,
  ) {
    super(detail === undefined ? message : `${message} -- ${detail}`, originator === undefined ? undefined : { cause: originator });
    this.name = new.target.name;
    this.headline = message;
  }
}

/** The caller sent a subscription spec this package cannot compile. */
export class SpecError extends HiveNodeError {
  public constructor(message: string, detail?: string, originator?: unknown) {
    super(message, "invalid_spec", detail, originator);
  }
}

/** The requested resource (account, block) does not exist. */
export class NotFoundError extends HiveNodeError {
  public constructor(message: string) {
    super(message, "not_found");
  }
}

/** The configured Hive API credential is present but could not be read. */
export class CredentialError extends HiveNodeError {
  public constructor(message: string, detail?: string, originator?: unknown) {
    super(message, "credential_error", detail, originator);
  }
}

/** The Hive node failed or returned something unusable. */
export class UpstreamError extends HiveNodeError {
  public constructor(message: string, detail?: string, originator?: unknown) {
    super(message, "upstream_error", detail, originator);
  }
}
