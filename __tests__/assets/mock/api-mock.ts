import type { Request, Response } from "express";

export type TTestAnySerializableTypeExceptUndefined = string | number | boolean | Record<string, unknown> | Array<unknown>;

export type TJsonRpcResponse = {
  id: number;
  jsonrpc: string;
  result?: TTestAnySerializableTypeExceptUndefined;
  error?: TTestAnySerializableTypeExceptUndefined;
};

export interface IApiMockData {
  [key: string]: (params: Record<string, unknown>) => TTestAnySerializableTypeExceptUndefined | void;
}

export interface IJsonRpcMockData {
  [key: string]: (request: Record<string, unknown>) => TJsonRpcResponse | void;
}

export type TMockData = IApiMockData | IJsonRpcMockData;

export abstract class AProxyMockResolver {
  public abstract hasHandler(req: Request): boolean;

  public abstract handle(req: Request, res: Response): void;
}

export class JsonRpcMock extends AProxyMockResolver {
  private readonly mockData: TMockData;

  public constructor(mockData: TMockData) {
    super();
    this.mockData = mockData;
  }

  public hasHandler (req: Request): boolean {
    if (req.method !== "POST" || typeof req.body !== "object")
      return false;

    const { method } = req.body;

    if (typeof method !== "string")
      return false;

    if (method in this.mockData && typeof this.mockData[method] === "function")
      return true;

    return false;
  }

  public handle (req: Request, res: Response): void {
    const { method } = req.body;

    if (Object.prototype.hasOwnProperty.call(this.mockData, method)) {
      const mockFn = this.mockData[method];
      if (typeof mockFn === "function") {
        const response = mockFn(req.body);

        res.json(response);
        return;
      }
    }

    throw new Error(`Method ${method} is not implemented`);
  }
}
