/**
 * Which nodes currently hold a live subscription, for the whole n8n process.
 *
 * n8n hands back one `closeFunction` per `trigger()` call and keeps only the
 * newest. Activating a workflow that is already active therefore leaves the
 * previous subscription with nothing able to reach it: its reference on the bot
 * is never dropped, so the pool's block poller never stops, and a workflow the
 * user has since deactivated goes on starting executions. With two live
 * subscriptions every event is handled twice -- on the reply bot that meant
 * answering each comment twice, on chain, where it cannot be taken back.
 *
 * Deactivating and re-activating is also how a user changes a spec, so this is
 * the ordinary path rather than an edge case.
 */
const live = new Map<string, () => Promise<void>>();

/**
 * Close whatever is already subscribed for `key`.
 *
 * Awaited before the new subscription opens, so the pool sees the old reference
 * go before the new one arrives rather than briefly holding two chains for one
 * node. A close that throws is not allowed to stop the re-activation: the entry
 * is dropped either way, because leaving it would make the next activation try
 * to close it again.
 */
export async function closePrevious(key: string): Promise<void> {
  const previous = live.get(key);
  if (previous === undefined) return;

  live.delete(key);
  await previous().catch(() => undefined);
}

export function remember(key: string, close: () => Promise<void>): void {
  live.set(key, close);
}

/**
 * Drop `key`, but only if `close` is still the function registered under it.
 *
 * Without the identity check a late close from a superseded subscription would
 * delete the live one's entry, and the next activation would find nothing to
 * close -- reopening the very leak this module exists to prevent.
 */
export function forget(key: string, close: () => Promise<void>): void {
  if (live.get(key) === close) live.delete(key);
}

/** The nodes currently subscribed, for `Chain: Get Health`. */
export const subscribedNodes = (): string[] => [...live.keys()].sort();
