/**
 * The dropdown feeders.
 *
 * All four read the local catalog, which is generated from `events.ts` -- so the
 * editor works with no Hive node reachable and with no network round trip.
 */
import type { ILoadOptionsFunctions, INodePropertyOptions } from "n8n-workflow";

import { buildCatalog, fieldOptions, toOptions } from "./catalog";

/**
 * The tag selected in the fixed-collection entry a parameter dropdown belongs to.
 *
 * The obvious `getCurrentNodeParameter("&event")` cannot reach it. n8n resolves
 * `&` against the *immediate* collection entry -- `LoadOptionsContext` rewrites
 * the name as `path.split(".").slice(1, -1).join(".") + "." + name` -- and the
 * event lives one collection level up:
 *
 *     events.event[0].event                          <- the selected event
 *     events.event[0].parameters.parameter[0].name   <- this dropdown
 *
 * so `&event` asks for `...parameter[0].event`, which does not exist. It
 * silently returns undefined, which is why every parameter dropdown used to
 * offer the union of all 14 parameter names and let you pick one the event does
 * not accept.
 *
 * The context keeps the path it was constructed with, so the entry's own path is
 * rebuilt from it. That field is not part of `ILoadOptionsFunctions`, hence the
 * guard: if it ever goes away, this returns undefined and the caller falls back
 * to the unnarrowed list exactly as before.
 */
function selectedTag(context: ILoadOptionsFunctions, tagField: "event" | "provider"): unknown {
  const path = (context as unknown as { path?: unknown }).path;
  if (typeof path !== "string") return undefined;

  const segments = path.split(".");
  /*
   * The first indexed segment is the collection entry: ["parameters", "events",
   * "event[0]", "parameters", "parameter[0]", "name"] -> "events.event[0]".
   */
  const entryIndex = segments.findIndex((segment) => segment.endsWith("]"));
  if (entryIndex <= 0) return undefined;

  /*
   * Dropping the first segment removes the leading "parameters.", which is not part of a path
   * into `currentNodeParameters`.
   */
  return context.getCurrentNodeParameter(`${segments.slice(1, entryIndex + 1).join(".")}.${tagField}`);
}

/*
 * Every loadOptions method is typed by n8n as Promise-returning, and none of these has
 * anything to await: the catalog is built from a local registry, which is the
 * whole point -- opening a dropdown must not reach the chain.
 */
export const loadOptions = {
  getEvents(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
    return Promise.resolve(toOptions(buildCatalog().events));
  },

  getProviders(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
    return Promise.resolve(toOptions(buildCatalog().providers));
  },

  getEventFields(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
    return Promise.resolve(fieldOptions(buildCatalog().events, selectedTag(this, "event")));
  },

  getProviderFields(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
    return Promise.resolve(fieldOptions(buildCatalog().providers, selectedTag(this, "provider")));
  },
};

