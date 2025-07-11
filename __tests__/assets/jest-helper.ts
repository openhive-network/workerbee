/* eslint-disable no-console */
import { ConsoleMessage, Page, test as base, expect } from "@playwright/test";

import "./globals";
import { IWorkerBee } from "../../dist/bundle";
import type { IWorkerBeeGlobals, TEnvType } from "./globals";

type TWorkerBeeTestCallable<R, Args extends any[]> = (globals: IWorkerBeeGlobals, ...args: Args) => (R | Promise<R>);

interface IWorkerBeeTestPlaywright {
  forEachTest: void;
}

export interface IWorkerBeeFixtureMethods {
  /**
   * Runs given function in both environments: web and Node.js
   * Created specifically for testing the wax code - base and chain
   * Contains beekeeper instance constructor (if required)
   *
   * Checks if results are equal. If your tests may differ please use {@link dual.dynamic}
   */
  workerbeeTest: (<R, Args extends any[]>(fn: TWorkerBeeTestCallable<R, Args>, ...args: Args) => Promise<R>) & {
    /**
     * Runs given function in both environments: web and Node.js
     *
     * Does not check if results are equal.
     */
    dynamic<R, Args extends any[]>(fn: TWorkerBeeTestCallable<R, Args>, ...args: Args): Promise<R>;
  };

  createWorkerBeeTest: <T = Record<string, any>>(
    callback: (bot: IWorkerBee<unknown>, resolve: (retVal?: T) => void, reject: (reason?: any) => void) => void,
    dynamic?: boolean
  ) => Promise<T>;
}

export interface IWorkerBeeTest extends IWorkerBeeFixtureMethods, IWorkerBeeTestPlaywright {}

interface IWorkerBeeWorker {
  forEachWorker: void;
}

const envTestFor = <GlobalType extends IWorkerBeeGlobals>(
  page: Page,
  globalFunction: (env: TEnvType) => Promise<GlobalType>
): IWorkerBeeTest["workerbeeTest"] => {

  const runner = async<R, Args extends any[]>(checkEqual: boolean, fn: TWorkerBeeTestCallable<R, Args>, ...args: Args): Promise<R> => {

    let nodeData = await fn(await (globalFunction as (...args: any[]) => any)("node"), ...args);
    const webData = await page.evaluate(async({ args: pageArgs, globalFunction: globalFn, webFn }) => {
      /* eslint-disable no-eval */
      eval(`window.webEvalFn = ${webFn};`);

      return (window as Window & typeof globalThis & { webEvalFn: (...args: any[]) => any }).webEvalFn(await globalThis[globalFn]("web"), ...pageArgs);
    }, { args, globalFunction: globalFunction.name, webFn: fn.toString() });

    if(typeof nodeData === "object") // Remove prototype data from the node result to match webData
      nodeData = JSON.parse(JSON.stringify(nodeData, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value
      ));

    if(checkEqual)
      expect(webData as any).toStrictEqual(nodeData);

    return webData;
  };

  const using = function<R, Args extends any[]>(fn: TWorkerBeeTestCallable<R, Args>, ...args: Args): Promise<R> {
    return runner.bind(undefined, true)(fn as any, ...args);
  };
  using.dynamic = runner.bind(undefined, false);

  return using as IWorkerBeeTest["workerbeeTest"];
};

const createWorkerBeeTest = async <T = Record<string, any>>(
  envTestFor: IWorkerBeeTest["workerbeeTest"],
  callback: (bot: IWorkerBee<unknown>, resolve: (retVal?: T) => void, reject: (reason?: any) => void) => void,
  dynamic: boolean = false
): Promise<T> => {
  const testRunner = dynamic ? envTestFor.dynamic : envTestFor;

  return await testRunner(async ({ WorkerBee }, callbackStr) => {
    const bot = new WorkerBee({ chainOptions: { apiTimeout: 0 } });
    await bot.start();

    const returnValue = await new Promise<T>((resolve, reject) => {
      // Reconstruct callback from string in web environment
      const reconstructedCallback = eval(`(${callbackStr})`);
      reconstructedCallback(bot, resolve, reject);
    });

    bot.stop();
    bot.delete();

    return returnValue;
  }, callback.toString());
}

export const test = base.extend<IWorkerBeeTest, IWorkerBeeWorker>({
  forEachTest: [async ({ page }, use, ) => {
    page.on("console", (msg: ConsoleMessage) => {
      console.log(">>", msg.type(), msg.text());
    });

    await page.goto("http://localhost:8080/__tests__/assets/test.html", { waitUntil: "load" });

    await use();
  }, { auto: true }],

  forEachWorker: [async ({ browser }, use) => {
    await use();

    await browser.close();
  }, { scope: "worker", auto: true }],

  workerbeeTest: ({ page }, use) => {
    use(envTestFor(page, createTestFor));
  },

  createWorkerBeeTest: ({ workerbeeTest }, use) => {
    use((callback, dynamic) => createWorkerBeeTest(workerbeeTest, callback, dynamic));
  }
});
