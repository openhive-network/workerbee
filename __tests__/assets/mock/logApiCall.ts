import fs from "node:fs";
import path from "node:path";

export const logApiCall = (method: string, req: unknown, res: unknown): void => {
  try {
    const logsDir = path.resolve(path.dirname(import.meta.dirname), "api-call-logs");

    if (!fs.existsSync(logsDir))
      fs.mkdirSync(logsDir, { recursive: true });

    const filePath = path.join(logsDir, `${method.replace(/[^a-zA-Z0-9_]/g, "_")}.json`);
    let arr: Array<{ req: unknown, res: unknown }> = [];

    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");

      try {
        arr = JSON.parse(content);

        if (!Array.isArray(arr))
          arr = [];
      } catch { arr = []; }
    }
    arr.push({ req, res });

    fs.writeFileSync(filePath, JSON.stringify(arr, null, 2));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Failed to log API call:", e);
  }
};
