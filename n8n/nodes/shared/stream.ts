/**
 * Bounded, non-blocking delivery of WorkerBee notifications to one consumer.
 *
 * WorkerBee calls a subscriber's `next` synchronously while it walks a block, so
 * that callback must never do work proportional to the consumer. This class puts
 * a hard bound in front of the consumer instead: {@link EventStream.push} only
 * shapes the items and enqueues them, and a full queue drops according to the
 * configured policy while counting the loss -- so a workflow slower than the
 * chain degrades visibly rather than silently growing without limit.
 */
import { EventEmitter } from "./emitter";
import type { TEmitMode, TEmittedItem } from "./emitter";

export const OVERFLOW_POLICIES = ["drop_oldest", "drop_newest"] as const;

export type TOverflow = (typeof OVERFLOW_POLICIES)[number];

export const DEFAULT_MAX_QUEUE = 500;

/** Matches `typeOptions.maxValue` on the Max Queue field and `maximum` in the JSON Schema. */
export const MAX_QUEUE_CEILING = 100000;

/**
 * The queue bound, defended against a value that never went through the
 * catalog's validator.
 *
 * `max_queue` reaches us straight from the Raw JSON spec field, where nothing
 * checks it. `Math.max(1, NaN)` is `NaN`, and `length >= NaN` is false for every
 * length -- so one non-numeric `max_queue` used to remove the bound entirely and
 * turn the one thing this class exists to guarantee into unbounded growth inside
 * the n8n process. Anything unusable falls back to the default instead.
 */
function boundedQueue(requested: unknown): number {
  const value = Number(requested);
  if (!Number.isFinite(value) || value < 1) return DEFAULT_MAX_QUEUE;
  /*
   * Clamped to the ceiling the JSON Schema and the number field already publish;
   * the Raw JSON path reaches neither, and a queue of five billion is the same
   * unbounded growth by another route.
   */
  return Math.min(Math.floor(value), MAX_QUEUE_CEILING);
}

/** Likewise: an unknown overflow policy must not silently read as "drop_oldest". */
function overflowPolicy(requested: unknown): TOverflow {
  return (OVERFLOW_POLICIES as readonly string[]).includes(requested as string) ? (requested as TOverflow) : "drop_oldest";
}

export interface IEventStreamOptions {
  mode?: TEmitMode;
  maxQueue?: number;
  overflow?: TOverflow;
  /**
   * Told about every pipeline error, with the running total.
   *
   * Without it `errors` and `lastError` are write-only: a Hive node returning 502
   * on every poll would leave the trigger looking active and healthy, emitting
   * nothing, until somebody deactivated the workflow and read the closing log.
   */
  onError?: (error: Error, total: number) => void;
}

export class EventStream {
  private readonly emitter: EventEmitter;
  private readonly queue: TEmittedItem[] = [];
  private readonly maxQueue: number;
  private readonly overflow: TOverflow;
  private readonly onError: ((error: Error, total: number) => void) | undefined;

  private waiting: ((item: TEmittedItem | null) => void) | null = null;
  private closed = false;

  /** Items dropped because the consumer could not keep up. */
  public dropped = 0;

  /** Items handed to the consumer. */
  public emitted = 0;

  /** Errors reported by the observer pipeline. */
  public errors = 0;

  /** The last pipeline error, kept so the node can surface it instead of guessing. */
  public lastError: Error | null = null;

  public constructor(
    public readonly subscriptionId: string,
    options: IEventStreamOptions = {},
  ) {
    this.emitter = new EventEmitter(subscriptionId, options.mode ?? "notification");
    this.maxQueue = boundedQueue(options.maxQueue ?? DEFAULT_MAX_QUEUE);
    this.overflow = overflowPolicy(options.overflow ?? "drop_oldest");
    this.onError = options.onError;
  }

  /** Observer `next` callback. Never blocks, never throws. */
  public readonly push = (notification: object): void => {
    if (this.closed) return;
    try {
      for (const item of this.emitter.build(notification)) this.offer(item);
    } catch (error) {
      this.pushError(error as Error);
    }
  };

  /** Observer `error` callback. A pipeline error is recorded, not fatal. */
  public readonly pushError = (error: Error): void => {
    this.errors += 1;
    this.lastError = error;
    // Never let a reporting failure escape into WorkerBee's block loop.
    try {
      this.onError?.(error, this.errors);
    } catch {
      // Nothing useful to do here; the counters still carry the loss.
    }
  };

  private offer(item: TEmittedItem): void {
    const waiting = this.waiting;
    if (waiting !== null) {
      /*
       * Somebody is already awaiting: hand it over without touching the queue,
       * so an idle consumer never sees an item counted as queued then dequeued.
       */
      this.waiting = null;
      this.emitted += 1;
      waiting(item);
      return;
    }

    if (this.queue.length >= this.maxQueue) {
      this.dropped += 1;
      if (this.overflow === "drop_newest") return;
      this.queue.shift();
    }

    this.queue.push(item);
  }

  /**
   * Await the next item, or `null` once the stream is closed.
   *
   * Deliberately has no timeout parameter: a caller that needs one races this
   * promise itself, which composes with cancellation properly.
   *
   * Single-consumer by contract -- one drain loop per subscription. A second
   * concurrent caller would overwrite the parked resolver and leave the first
   * promise pending for ever, so it is rejected loudly instead of hanging.
   */
  public get(): Promise<TEmittedItem | null> {
    const queued = this.queue.shift();
    if (queued !== undefined) {
      this.emitted += 1;
      return Promise.resolve(queued);
    }
    if (this.closed) return Promise.resolve(null);
    if (this.waiting !== null) return Promise.reject(new Error(`EventStream "${this.subscriptionId}" already has a consumer awaiting an item`));

    return new Promise((resolve) => {
      this.waiting = resolve;
    });
  }

  public get pending(): number {
    return this.queue.length;
  }

  public get isClosed(): boolean {
    return this.closed;
  }

  /** Stop the stream and release a consumer parked in {@link get}. */
  public close(): void {
    if (this.closed) return;
    this.closed = true;
    /*
     * Undelivered items are a loss like any other; not counting them made the
     * shutdown log under-report by up to a full queue.
     */
    this.dropped += this.queue.length;
    this.queue.length = 0;
    const waiting = this.waiting;
    this.waiting = null;
    if (waiting !== null) waiting(null);
  }

  /** Counters a node can surface without reaching into the internals. */
  public stats(): { emitted: number; dropped: number; errors: number; pending: number; lastError: string | null } {
    /*
     * `lastError` was write-only: kept "so the node can surface it instead of
     * guessing", and then surfaced nowhere. The message, not the Error, because
     * this is read into a log line and an item.
     */
    return { emitted: this.emitted, dropped: this.dropped, errors: this.errors, pending: this.pending, lastError: this.lastError?.message ?? null };
  }
}
