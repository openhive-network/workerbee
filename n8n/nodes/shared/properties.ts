/**
 * The visual spec builder, shared by the trigger and by the action node's spec
 * preview.
 *
 * Every dropdown is filled from the local catalog, which `catalog.ts` derives
 * from the observer registry in `events.ts`. The only thing this file
 * contributes is the shape of the form -- no event name appears in it.
 */
import type { IDisplayOptions, INodeProperties } from "n8n-workflow";

import { DEFAULT_MAX_QUEUE, MAX_QUEUE_CEILING } from "./stream";

const withDisplay = (properties: INodeProperties[], displayOptions?: IDisplayOptions): INodeProperties[] =>
  displayOptions === undefined
    ? properties
    : properties.map((property) => ({
      ...property,
      displayOptions: {
        ...displayOptions,
        show: { ...(displayOptions.show ?? {}), ...(property.displayOptions?.show ?? {}) },
      },
    }));

/**
 * @param displayOptions merged into every returned property, so the action node
 *   can scope the whole builder to one resource/operation pair.
 */
export function specProperties(displayOptions?: IDisplayOptions): INodeProperties[] {
  return withDisplay(
    [
      {
        displayName: "Spec Mode",
        name: "specMode",
        type: "options",
        noDataExpression: true,
        options: [
          {
            name: "Builder",
            value: "builder",
            description: "Pick events and providers from dropdowns generated from WorkerBee's own observers",
          },
          {
            name: "Raw JSON",
            value: "json",
            description: "Write the subscription spec by hand, for shapes the builder cannot express",
          },
        ],
        default: "builder",
      },
      {
        displayName: "Events",
        name: "events",
        type: "fixedCollection",
        typeOptions: {
          multipleValues: true,
          sortable: true,
          /*
           * Renders "OR posts" / "AND impacted_accounts" as the entry's title, so
           * the grouping is legible without opening every row. The tag is used
           * raw because the options are loaded dynamically, so there is no static
           * option list to look a display name up in.
           */
          fixedCollection: {
            itemTitle:
              '={{ ($collection.item.value.joinWithPrevious === "and" ? "AND " : "OR ") + ($collection.item.value.event || "(pick an event)") }}',
          },
        },
        placeholder: "Add Event",
        default: {},
        displayOptions: { show: { specMode: ["builder"] } },
        description: "What to watch, read top to bottom. One entry per WorkerBee filter; each says how it joins the entry above it.",
        options: [
          {
            name: "event",
            displayName: "Event",
            values: [
              {
                displayName: "Event Name or ID",
                name: "event",
                type: "options",
                typeOptions: { loadOptionsMethod: "getEvents" },
                default: "",
                required: true,
                description:
                  "The observer to subscribe to, generated from the WorkerBee observers this package wraps. " +
                  '<a href="https://gitlab.syncad.com/hive/workerbee/-/tree/develop/n8n">Docs</a>. ' +
                  'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
              },
              {
                displayName: "Join With Previous",
                name: "joinWithPrevious",
                type: "options",
                options: [
                  { name: "Or", value: "or", description: "Fires when this event matches, or when the one above does" },
                  { name: "And", value: "and", description: "Requires this event and everything above it to match in the same block" },
                ],
                default: "or",
                description:

                    "How this event combines with the one above it, read top to bottom -- the same order as WorkerBee's own or/and chain. " +
                    "Consecutive Or entries form one group; an And closes the group and starts a new one. " +
                    "Ignored on the first entry, which has nothing above it.",
              },
              {
                displayName: "Parameters",
                name: "parameters",
                type: "fixedCollection",
                typeOptions: { multipleValues: true },
                placeholder: "Add Parameter",
                default: {},
                options: [
                  {
                    name: "parameter",
                    displayName: "Parameter",
                    values: [
                      {
                        displayName: "Name or ID",
                        name: "name",
                        type: "options",
                        typeOptions: { loadOptionsMethod: "getEventFields", loadOptionsDependsOn: ["events.event"] },
                        default: "",
                        description:
                          "The parameter to set; the list depends on the event above. Switch to Raw JSON for anything not offered. " +
                          '<a href="https://gitlab.syncad.com/hive/workerbee/-/tree/develop/n8n">Docs</a>. ' +
                          'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                      },
                      {
                        displayName: "Value",
                        name: "value",
                        type: "string",
                        default: "",
                        placeholder: "alice,bob",
                        description:
                          "Lists are comma-separated. Numbers and booleans are converted using the type the catalog declares. " +
                          "Object-valued parameters take JSON.",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        displayName: "Providers",
        name: "providers",
        type: "fixedCollection",
        typeOptions: {
          multipleValues: true,
          sortable: true,
          fixedCollection: { itemTitle: '={{ $collection.item.value.provider || "(pick a provider)" }}' },
        },
        placeholder: "Add Provider",
        default: {},
        displayOptions: { show: { specMode: ["builder"] } },
        description: "Extra data merged into every emitted payload, regardless of which event fired",
        options: [
          {
            name: "provider",
            displayName: "Provider",
            values: [
              {
                displayName: "Provider Name or ID",
                name: "provider",
                type: "options",
                typeOptions: { loadOptionsMethod: "getProviders" },
                default: "",
                required: true,
                description:
                  "Data to attach to every notification, generated from the WorkerBee providers this package wraps. " +
                  '<a href="https://gitlab.syncad.com/hive/workerbee/-/tree/develop/n8n">Docs</a>. ' +
                  'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
              },
              {
                displayName: "Parameters",
                name: "parameters",
                type: "fixedCollection",
                typeOptions: { multipleValues: true },
                placeholder: "Add Parameter",
                default: {},
                options: [
                  {
                    name: "parameter",
                    displayName: "Parameter",
                    values: [
                      {
                        displayName: "Name or ID",
                        name: "name",
                        type: "options",
                        typeOptions: { loadOptionsMethod: "getProviderFields", loadOptionsDependsOn: ["providers.provider"] },
                        default: "",
                        description:
                          "The parameter to set; the list depends on the provider above. " +
                          '<a href="https://gitlab.syncad.com/hive/workerbee/-/tree/develop/n8n">Docs</a>. ' +
                          'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                      },
                      {
                        displayName: "Value",
                        name: "value",
                        type: "string",
                        default: "",
                        placeholder: "alice,bob",
                        description: "Lists are comma-separated. Numbers and booleans are converted using the type the catalog declares.",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        displayName: "Spec (JSON)",
        name: "specJson",
        type: "json",
        default: '{\n  "match": [\n    [{ "event": "posts", "authors": ["alice"] }]\n  ],\n  "provide": [{ "provide": "block_header_data" }]\n}',
        displayOptions: { show: { specMode: ["json"] } },
        description: '"match" is an AND of OR-groups. The Hive node\'s "Catalog: Get Events" operation lists every event, provider and parameter.',
      },
      {
        displayName: "Emit Mode",
        name: "emitMode",
        type: "options",
        options: [
          {
            name: "Notification",
            value: "notification",
            description: "One item per WorkerBee notification, carrying the whole merged payload",
          },
          {
            name: "Operation",
            value: "operation",
            description: "One item per individual operation, so an IF node tests a single operation instead of an array",
          },
        ],
        default: "notification",
      },
      {
        displayName: "Spec Options",
        name: "specOptions",
        type: "collection",
        placeholder: "Add Option",
        default: {},
        options: [
          {
            displayName: "Hive API Endpoint",
            name: "endpoint",
            type: "string",
            default: "",
            placeholder: "https://api.hive.blog/",
            description:
              "Overrides the Hive node from the credential, for this subscription only. " +
              "One block stream is shared per endpoint, so reusing the default is cheaper.",
          },
          {
            displayName: "Max Queue",
            name: "maxQueue",
            type: "number",
            typeOptions: { minValue: 1, maxValue: MAX_QUEUE_CEILING },
            default: DEFAULT_MAX_QUEUE,
            description: "How many items may wait for delivery before the overflow policy applies",
          },
          {
            displayName: "Overflow",
            name: "overflow",
            type: "options",
            options: [
              { name: "Drop Oldest", value: "drop_oldest" },
              { name: "Drop Newest", value: "drop_newest" },
            ],
            default: "drop_oldest",
            description: "What to drop when the workflow is slower than the chain. Drops are counted and reported to the n8n log.",
          },
        ],
      },
    ],
    displayOptions,
  );
}
