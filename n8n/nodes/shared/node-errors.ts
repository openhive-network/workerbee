/**
 * Translate this package's errors into the ones n8n understands, at the node
 * boundary and nowhere else.
 *
 * Internally the package throws {@link HiveNodeError} subclasses, which carry a
 * stable `code` and know nothing about n8n. That is deliberate: `compiler.ts` and
 * `spec.ts` are driven by tests that never construct an `INode`. But an error
 * that actually leaves a node has to be a `NodeOperationError` or a
 * `NodeApiError`, or n8n cannot classify it, retry it, or render it properly --
 * and its own lint rules (`require-node-api-error`,
 * `node-execute-block-wrong-error-thrown`) say so.
 *
 * The node files call this at each point they throw, and `execute()`/`trigger()`
 * catch whatever came from deeper in and convert that too -- `nodes/shared/*`
 * has no `INode`, and its tests never build one. n8n's own lint wants the first
 * of those (it is syntactic, and scans every file under `nodes/**`); the second
 * is what actually guarantees nothing untranslated escapes.
 *
 * `n8n-workflow` is a peer dependency, provided by the n8n that loads this
 * package -- see the note in `package.json` and the entrypoint's symlink.
 */
import { NodeApiError, NodeOperationError } from "n8n-workflow";
import type { INode, JsonObject } from "n8n-workflow";

import { HiveNodeError, UpstreamError } from "./errors";

/**
 * The n8n-shaped equivalent of `error`.
 *
 * An {@link UpstreamError} becomes a `NodeApiError`, because it means the Hive
 * node failed rather than the workflow being wrong; everything else becomes a
 * `NodeOperationError`.
 *
 * Where the machine-readable `code` ends up differs between the two, because n8n
 * gives them different slots and neither is a free-form bag:
 *
 * * `NodeOperationError` has a `type`, which is exactly this concept, so the
 *   code goes there and a workflow branches on `error.type`;
 * * `NodeApiError` has no `type` -- its classification is `httpCode`, and the
 *   error response it is handed is parsed for one. Passing our `code` in that
 *   object made n8n report `httpCode: "upstream_error"`, an HTTP status that
 *   does not exist. So it is left out, and the branch for an API failure is the
 *   class itself: `error.name === "NodeApiError"`.
 */
export function asNodeError(node: INode, error: unknown, itemIndex?: number): Error {
  /*
   * Already translated -- a node file throws these directly, and `execute` sees
   * them again on the way out. n8n's own constructors happen to hand the same
   * instance back rather than nesting, but relying on that silently would make a
   * future change to it look like a bug here instead of in the wrapper.
   */
  if (error instanceof NodeApiError || error instanceof NodeOperationError) return error;

  /*
   * `headline`, not `message`: the latter already ends with the detail, and n8n
   * renders title and description one above the other, so passing the joined
   * string as the title prints the detail twice.
   */
  if (error instanceof UpstreamError)
    return new NodeApiError(node, { message: error.headline } as JsonObject, { message: error.headline, ...describe(error.detail, itemIndex) });

  if (error instanceof HiveNodeError)
    return new NodeOperationError(node, error, { message: error.headline, type: error.code, ...describe(error.detail, itemIndex) });

  /*
   * Anything else is a bug or a library failure; wrapping it keeps the stack and
   * still gives n8n something it can render.
   */
  return new NodeOperationError(node, error as Error, describe(undefined, itemIndex));
}

/**
 * The two optional halves of an n8n error's options.
 *
 * Spread rather than assigned: n8n types both as plain optional properties, so
 * under `exactOptionalPropertyTypes` writing `description: undefined` is not the
 * same as leaving it out -- and leaving it out is what was meant.
 */
function describe(detail: string | undefined, itemIndex: number | undefined): { description?: string; itemIndex?: number } {
  return { ...(detail === undefined ? {} : { description: detail }), ...(itemIndex === undefined ? {} : { itemIndex }) };
}
