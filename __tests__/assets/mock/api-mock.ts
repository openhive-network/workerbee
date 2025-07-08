import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";
import type { Request, Response } from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const hasLogFileForMethod = (method: string): boolean => {
  const logPath = path.resolve(__dirname, "../api-call-logs", `${method.replace(/[^a-zA-Z0-9_]/g, "_")}.json`);

  return fs.existsSync(logPath);
};

export type TTestAnySerializableTypeExceptUndefined = string | number | boolean | Record<string, unknown> | Array<unknown>;

export type TJsonRpcResponse = {
  id: number;
  jsonrpc: string;
  result: TTestAnySerializableTypeExceptUndefined;
};

export interface IApiMockData {
  [key: string]: (params: Record<string, unknown>) => TTestAnySerializableTypeExceptUndefined | void;
}

export interface IJsonRpcMockData {
  [key: string]: (params: Record<string, unknown>) => unknown;
}

export type TMockData = IApiMockData | IJsonRpcMockData;

const mockCallIndexes: Record<string, number> = {};

export abstract class AProxyMockResolver {
  public abstract hasHandler(req: Request): boolean;

  public abstract handle(req: Request, res: Response): void;
}

export class JsonRpcMock {
  public hasHandler (req: Request): boolean {
    const { method } = req.body;

    if (req.method !== "POST" || typeof req.body !== "object" || typeof method !== "string")
      return false;

    return hasLogFileForMethod(method);
  }

  public handle (req: Request, res: Response): void {
    const { method } = req.body;

    const logPath = path.resolve(__dirname, "../api-call-logs", `${method.replace(/[^a-zA-Z0-9_]/g, "_")}.json`);

    if (fs.existsSync(logPath)) {
      const arr = JSON.parse(fs.readFileSync(logPath, "utf-8"));

      if (!Array.isArray(arr) || arr.length === 0) {
        res.status(501).json({ error: "No mock data in log file" });

        return;
      }

      if (!(method in mockCallIndexes))
        mockCallIndexes[method] = 0;

      const idx = mockCallIndexes[method];
      const entry = arr[idx] || arr[arr.length - 1];

      mockCallIndexes[method]++;

      if (!entry || !entry.res)
        res.status(501).json({ error: `No mock log file for method ${method}` });

      res.json(entry.res);

      return;
    }
    res.status(501).json({ error: `No mock log file for method ${method}` });
  }
}

export const resetMockCallIndexes = (): void => {
  for (const key in mockCallIndexes)
    delete mockCallIndexes[key];

};
