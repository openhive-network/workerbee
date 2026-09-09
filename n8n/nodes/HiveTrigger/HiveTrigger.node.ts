/**
 * Hive Trigger -- starts a workflow on Hive blockchain events.
 *
 * The subscription runs inside n8n: activating the workflow compiles the spec
 * into a WorkerBee observer chain over the block stream this process already
 * keeps for the endpoint, and every notification becomes one or more items.
 * There is no companion service to deploy, and no HTTP hop between the chain and
 * the workflow.
 *
 * Two consequences worth knowing:
 *
 * * The subscription lives and dies with the n8n instance that activated it. It
 *   is re-created on restart, like any other trigger, but nothing is buffered
 *   while n8n is down -- for a gap-free feed, pair this with `Hive: Get Block`
 *   over the missed range.
 * * A workflow slower than the chain cannot slow the chain down. Items queue up
 *   to `Max Queue` and then the overflow policy applies, with drops counted and
 *   logged rather than silently absorbed.
 */
import type { IDataObject, INodeType, INodeTypeDescription, ITriggerFunctions, ITriggerResponse, NodeConnectionType } from "n8n-workflow";

import { botPool } from "../shared/chain";
import { compileSpec } from "../shared/compiler";
import { resolveChainId, resolveEndpoint } from "../shared/credentials";
import type { TEmitMode } from "../shared/emitter";
import { loadOptions } from "../shared/load-options";
import { asNodeError } from "../shared/node-errors";
import { specProperties } from "../shared/properties";
import { buildSpec } from "../shared/spec";
import { EventStream } from "../shared/stream";
import type { TOverflow } from "../shared/stream";
import { closePrevious, forget, remember } from "../shared/subscriptions";

export class HiveTrigger implements INodeType {
  public description: INodeTypeDescription = {
    displayName: "Hive Trigger",
    name: "hiveTrigger",
    icon: "file:hive.svg",
    group: ["trigger"],
    version: 1,
    subtitle: '={{$parameter["emitMode"]}}',
    description: "Starts a workflow on Hive blockchain events, observed directly by WorkerBee",
    defaults: { name: "Hive Trigger" },
    inputs: [],
    outputs: ["main" as NodeConnectionType],
    credentials: [{ name: "hiveApi", required: false }],
    // The spec builder is a three-column form; the default pane crops it.
    parameterPane: "wide",
    properties: specProperties(),
  };

  public methods = { loadOptions };

  public async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
    try {
      return await subscribe(this);
    } catch (error) {
      /*
       * Anything raised while activating -- an unusable spec, an unreachable
       * endpoint -- reaches the user through n8n's own error surface, so it has
       * to be an n8n error type by the time it leaves the node.
       */
      throw asNodeError(this.getNode(), error);
    }
  }
}

/**
 * Compile the spec, take a reference to the shared bot, and start draining.
 *
 * A free function rather than the body of `trigger`, so that one `catch` there
 * covers all of it without indenting a hundred lines to say so.
 */
async function subscribe(context: ITriggerFunctions): Promise<ITriggerResponse> {
  const spec = buildSpec((name, fallback) => context.getNodeParameter(name, fallback));
  const endpoint = await resolveEndpoint(context, spec.endpoint);
  const chainId = await resolveChainId(context);

  const node = context.getNode();

  /*
   * Node id rather than name: renaming a node in the editor re-activates it, and
   * keying on the name would orphan the subscription under the old one.
   */
  const key = `${context.getWorkflow().id ?? "workflow"}:${node.id ?? node.name}`;
  await closePrevious(key);

  /*
   * Throttled, because a Hive node that is down produces one of these per poll
   * tick: say it at once, then at most once a minute, so the log carries the
   * signal without becoming the problem.
   */
  let nextErrorLog = 0;
  const stream = new EventStream(`${node.name}-${context.getWorkflow().id ?? "workflow"}`, {
    mode: (spec.mode ?? "notification") as TEmitMode,
    ...(spec.max_queue === undefined ? {} : { maxQueue: spec.max_queue }),
    ...(spec.overflow === undefined ? {} : { overflow: spec.overflow as TOverflow }),
    onError: (error, total) => {
      if (Date.now() < nextErrorLog) return;
      nextErrorLog = Date.now() + ERROR_LOG_INTERVAL_MS;
      context.logger.warn(`Hive Trigger "${node.name}" observer error #${total} on ${endpoint}: ${error.message}`);
    },
  });

  const handle = await botPool.acquire(endpoint, chainId);
  let subscription: { unsubscribe(): void } | undefined;
  try {
    subscription = compileSpec(handle.bot.observe, spec).subscribe({
      next: stream.push,
      error: stream.pushError,
    });
  } catch (error) {
    handle.release();
    throw asNodeError(context.getNode(), error);
  }

  context.logger.info(`Hive Trigger "${node.name}" watching ${endpoint}`, { spec: spec as unknown as IDataObject });

  /*
   * One drain loop per subscription. It is deliberately not awaited: `trigger`
   * must return so n8n can finish activating the workflow.
   */
  let draining = true;
  const firstItem = deferred();

  const drain = async (): Promise<void> => {
    let reportedDrops = 0;
    while (draining) {
      const item = await stream.get();
      if (item === null) break;

      context.emit([context.helpers.returnJsonArray([item as unknown as IDataObject])]);
      firstItem.resolve();

      if (stream.dropped > reportedDrops) {
        reportedDrops = stream.dropped;
        context.logger.warn(
          `Hive Trigger "${node.name}" dropped ${reportedDrops} item(s): the workflow is slower than the chain. ` +
            "Raise Max Queue, switch Overflow, or move the slow work into a sub-workflow.",
        );
      }
    }
  };

  void drain().catch((error: Error) => {
    /*
     * The loop only fails if `emit` itself throws, which means n8n cannot
     * start executions any more -- a fatal condition for this trigger. Let go
     * of the subscription and the bot before reporting it, or the trigger dies
     * still holding a poller nothing will ever stop.
     */
    void closeFunction().catch(() => undefined);
    context.emitError(error);
  });

  /*
   * Every step runs even if an earlier one throws: a failed `unsubscribe` used
   * to skip `handle.release()`, which pins the bot's reference count above zero
   * for the life of the process -- the poller never stops and the endpoint slot
   * is gone until n8n restarts.
   */
  const closeFunction = (): Promise<void> => {
    forget(key, closeFunction);

    draining = false;
    try {
      subscription?.unsubscribe();
    } finally {
      try {
        stream.close();
      } finally {
        handle.release();
      }
    }
    const { emitted, dropped, errors, lastError } = stream.stats();
    context.logger.info(
      `Hive Trigger "${node.name}" stopped after ${emitted} item(s), ${dropped} dropped, ${errors} pipeline error(s)` +
        (lastError === null ? "" : `; last error: ${lastError}`),
    );

    // Typed by n8n as Promise-returning; nothing here is awaitable.
    return Promise.resolve();
  };

  remember(key, closeFunction);

  return {
    closeFunction,
    /*
     * "Test step" in the editor: resolve as soon as the chain produces
     * something, so the button stops spinning on the first matching block.
     */
    manualTriggerFunction: () => firstItem.promise,
  };
}

/** How rarely a repeating observer error is allowed to reach the log. */
const ERROR_LOG_INTERVAL_MS = 60_000;

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}
