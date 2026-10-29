import fs from "node:fs";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import type { Request, Response } from "express";
import { AProxyMockResolver, type TJsonRpcResponse } from "./api-mock";

/** Records the node's responses (instead of replaying them) when set to the node URL, e.g. `https://api.hive.blog` */
export const RECORD_FROM_ENV = "WORKERBEE_TEST_RECORD_FROM";

interface IRecordedCall {
  request: { method: string; params: unknown };
  response: Omit<TJsonRpcResponse, "id">;
}

const callKey = (method: string, params: unknown): string => `${method}:${JSON.stringify(params)}`;

/**
 * The JSON-RPC calls one test made, in the order the node answered them, stored gzipped as `<name>.json.gz`.
 */
export class ApiRecording {
  private readonly calls: IRecordedCall[];
  private readonly responsesPerCall = new Map<string, Array<IRecordedCall["response"]>>();
  private changed = false;

  public constructor(
    private readonly file: string
  ) {
    this.calls = fs.existsSync(file) ? JSON.parse(gunzipSync(fs.readFileSync(file)).toString("utf-8")) : [];

    for(const call of this.calls)
      this.index(call);
  }

  public get name(): string {
    return path.basename(this.file);
  }

  public responses(method: string, params: unknown): ReadonlyArray<IRecordedCall["response"]> {
    return this.responsesPerCall.get(callKey(method, params)) ?? [];
  }

  public add(method: string, params: unknown, response: IRecordedCall["response"]): void {
    const call = { request: { method, params }, response };

    this.calls.push(call);
    this.index(call);
    this.changed = true;
  }

  public save(): void {
    if (!this.changed)
      return;

    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, gzipSync(JSON.stringify(this.calls), { level: 9 }));
    this.changed = false;
  }

  private index(call: IRecordedCall): void {
    const key = callKey(call.request.method, call.request.params);
    const responses = this.responsesPerCall.get(key);

    if (responses === undefined)
      this.responsesPerCall.set(key, [ call.response ]);
    else
      responses.push(call.response);
  }
}

interface IReplay {
  recording: ApiRecording;
  nextResponse: Map<string, number>;
}

/**
 * A Hive node that answers from {@link ApiRecording}s. Each call to {@link route} replays a recording from its start under a new
 * URL path, so requests of a bot left running by an earlier run or test cannot consume the responses meant for the current one.
 *
 * A call is answered with the next response recorded for the same method and params; past the last one, the last one is repeated.
 * With an upstream node, calls past the recorded ones are forwarded to it and added to the recording instead.
 */
export class RecordedJsonRpcNode extends AProxyMockResolver {
  private readonly replays = new Map<string, IReplay>();
  private lastRouteId = 0;

  public constructor(
    private readonly upstream?: string
  ) {
    super();
  }

  /** @returns The URL path to use as the API endpoint (appended to the server's URL) */
  public route(recording: ApiRecording): string {
    const routePath = `/replay-${++this.lastRouteId}`;

    this.replays.set(routePath, { recording, nextResponse: new Map() });

    return routePath;
  }

  /** Detaches all the recordings: later requests on their routes get an error response */
  public reset(): void {
    this.replays.clear();
  }

  public hasHandler(req: Request): boolean {
    return req.method === "POST" && typeof req.body === "object" && typeof req.body.method === "string";
  }

  public handle(req: Request, res: Response): void {
    const { id, method, params } = req.body as { id: number; method: string; params: unknown };

    void this.respond(req.path, method, params).then(response => {
      res.json({ ...response, id });
    }, (error: Error) => {
      res.json({ jsonrpc: "2.0", id, error: { code: -32603, message: `${this.upstream} did not answer ${method}: ${error.message}` } });
    });
  }

  private async respond(routePath: string, method: string, params: unknown): Promise<IRecordedCall["response"]> {
    const replay = this.replays.get(routePath);

    if (replay === undefined)
      return { jsonrpc: "2.0", error: { code: -32603, message: `No recording is attached to ${routePath} (the test that used it has finished)` } };

    const key = callKey(method, params);
    const index = replay.nextResponse.get(key) ?? 0;
    replay.nextResponse.set(key, index + 1);

    const recorded = replay.recording.responses(method, params);

    if (index < recorded.length)
      return recorded[index];

    if (this.upstream !== undefined) {
      const response = await this.forward(method, params);
      replay.recording.add(method, params, response);

      return response;
    }

    if (recorded.length > 0)
      return recorded[recorded.length - 1];

    return { jsonrpc: "2.0", error: { code: -32603, message:
      `${replay.recording.name} has no response recorded for ${key}. Record it by running the test with ${RECORD_FROM_ENV}=https://api.hive.blog` } };
  }

  private async forward(method: string, params: unknown): Promise<IRecordedCall["response"]> {
    const response = await fetch(this.upstream!, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 0, method, params })
    });

    const { id: _id, ...body } = await response.json() as TJsonRpcResponse;

    return body;
  }
}
