/* eslint-disable no-console */
import type { Server } from "http";
import cors from "cors";
import express from "express";
import type { AProxyMockResolver } from "./api-mock";
import { logApiCall } from "./logApiCall";

export const createServer = async (mockInstance: AProxyMockResolver, port: number = 28091) => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use("/", async (req, res) => {
    console.log("Request URL:", req.originalUrl);
    console.log("Request", req.body);

    if (mockInstance.hasHandler(req)) {
      const originalJson = res.json.bind(res);

      res.json = (body) => {
        originalJson(body);

        return res;
      };

      mockInstance.handle(req, res);

      return;
    }

    try {
      const apiUrl = "https://api.fake.openhive.network";

      const proxyRes = await fetch(apiUrl, {
        method: req.method,
        headers: Object.fromEntries(Object.entries(req.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(", ") : value || ""])),
        body: JSON.stringify(req.body),
      });

      const data = await proxyRes.json();

      logApiCall(req.body?.method || "proxy_unknown_method", req.body, data);
      res.status(proxyRes.status).json(data);
    } catch (error) {
      res.status(502).json({ error: "Proxy error", details: (error as Error).message });
    }
  });

  let server: Server;

  await new Promise<void>((resolve, reject) => {
    server = app.listen(port, (error?: Error) => {
      if(error != undefined)
        reject(error);
      else
        resolve();
    });
  });

  return (): Promise<void> => new Promise<void>((resolve, reject) => {
    server.close(err => {
      if (err)
        reject(err);
      else
        resolve();
    });
  });
};
