import type { ICredentialType, INodeProperties } from "n8n-workflow";

/**
 * A Hive account and its posting key, for the one operation that writes.
 *
 * Kept apart from `HiveApi` on purpose. That credential is optional and holds no
 * secrets, because everything else this package does is read-only. This one
 * holds a private key, so it is separate, required only by `Comment: Reply`, and
 * absent from every workflow that does not publish.
 *
 * **Posting authority only.** A posting key can comment, vote and reblog; it
 * cannot move funds, change keys, or alter the account. Never put an active or
 * owner key here -- nothing in this package needs one, and n8n's credential
 * store is not the place for a key that can empty an account.
 *
 * There is no Test button, and the reason is n8n's, not Hive's. A declarative
 * `ICredentialTestRequest` can only interpolate fields of *this* credential,
 * which holds no endpoint, so it would have to hardcode `api.hive.blog` -- wrong
 * for exactly the testnet and mirrornet users the `HiveApi` chain ID field
 * exists to serve. (Deriving the public key and comparing it against the
 * account's authorities *would* say something real, but that needs a
 * programmatic `methods.credentialTest` on the node, not a declarative one.)
 *
 * A wrong key therefore fails on the first reply, reported as a credential
 * error rather than as the endpoint failing.
 */
export class HivePostingKey implements ICredentialType {
  public name = "hivePostingKey";

  public displayName = "Hive Posting Key";

  public documentationUrl = "https://gitlab.syncad.com/hive/workerbee/-/tree/develop/n8n";

  public properties: INodeProperties[] = [
    {
      displayName: "Account",
      name: "account",
      type: "string",
      default: "",
      required: true,
      placeholder: "hiveio",
      description: "The Hive account the reply is published as, without the leading @",
    },
    {
      displayName: "Posting Key",
      name: "postingKey",
      type: "string",
      typeOptions: { password: true },
      default: "",
      required: true,
      description:
        "The account's private posting key, in WIF format. Posting authority only -- never an active or owner key. " +
        "It is held in memory for signing and is never written to disk or logged.",
    },
  ];
}
