/*
 * Shared fixtures. No mocking library and no monkey-patching: the QueenBee under
 * test is the real one, so a rename in ../src breaks these tests rather than
 * slipping through into a node that throws at runtime.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export const shared = (name) => require(`../dist/nodes/shared/${name}.js`);

/**
 * A stand-in for QueenBee that records the calls a descriptor makes.
 *
 * Returns itself from every method, which is exactly the contract `apply` relies
 * on, so it exercises the real compilation path without a chain.
 */
export function recorder() {
  const calls = [];
  const chain = new Proxy(
    {},
    {
      get(_target, property) {
        if (property === "and") {
          calls.push(["and"]);
          return chain;
        }
        if (property === "subscribe") return (observer) => ({ unsubscribe: () => calls.push(["unsubscribe"]), observer });
        return (...args) => {
          calls.push([String(property), ...args]);
          return chain;
        };
      },
    },
  );
  return { chain, calls };
}

/**
 * A bot factory handing out recording stand-ins, for driving a BotPool offline.
 *
 * `calls` is the whole point. The pool's own `polling` flag cannot witness
 * `start()`/`stop()`, because the pool is what sets it -- a test reading that
 * flag stays green with the calls deleted.
 */
export function fakeBots() {
  const calls = [];
  const created = [];

  const factory = {
    create: async (endpoint) => {
      const bot = {
        endpoint,
        start: () => calls.push(["start", endpoint]),
        stop: () => calls.push(["stop", endpoint]),
        delete: () => calls.push(["bot.delete", endpoint]),
      };
      const chain = { endpoint, delete: () => calls.push(["chain.delete", endpoint]) };
      created.push({ bot, chain });
      return { bot, chain };
    },
  };

  return { factory, calls, created, verbs: () => calls.map(([verb]) => verb) };
}

/** A real WorkerBee over a real (unstarted) wax chain. */
export async function realBot(endpoint = "https://api.hive.blog/") {
  const wax = await import("@hiveio/wax");
  const workerbee = await import("../dist/workerbee/index.mjs");
  const chain = await wax.createHiveChain({ apiEndpoint: endpoint });
  const bot = new workerbee.default(chain);
  return { bot, close: () => chain.delete() };
}
