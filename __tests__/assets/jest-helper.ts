/* eslint-disable no-console */
import type { IHiveChainInterface } from "@hiveio/wax";
import { test as base, expect } from "@playwright/test";
import type { ConsoleMessage, Page } from "@playwright/test";

import "./globals";
import type { IWorkerBee } from "../../src/index";
import type { TPastQueen } from "../../src/past-queen";
import type { QueenBee } from "../../src/queen";
import type { IWorkerBeeGlobals, TEnvType } from "./globals";
import { JsonRpcMock } from "./mock/api-mock";
import jsonRpcMockData, { resetMockCallCounters } from "./mock/jsonRpcMock";
import { createServer } from "./mock/proxy-mock-server";

type TWorkerBeeTestCallable<R, Args extends any[]> = (globals: IWorkerBeeGlobals, ...args: Args) => (R | Promise<R>);
/* eslint-disable-next-line no-var */
declare var createTestFor: (env: TEnvType) => Promise<IWorkerBeeGlobals>;

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
    callback: (bot: QueenBee<{}> | TPastQueen<{}>, resolve: (retVal?: T) => void, reject: (reason?: any) => void, chain?: IHiveChainInterface) => void,
    pastDataFrom?: number,
    pastDataTo?: number,
    dynamic?: boolean,
    isMockEnvironment?: boolean
  ) => Promise<T>;

  createMockWorkerBeeTest: <T = Record<string, any>>(
    callback: (bot: QueenBee<{}> | IWorkerBee, resolve: (retVal?: T) => void, reject: (reason?: any) => void, chain?: IHiveChainInterface) => void,
    dynamic?: boolean,
    shouldHaveFullWorkerBeeInterface?: boolean
  ) => Promise<T>;
}

export interface IWorkerBeeTest extends IWorkerBeeFixtureMethods, IWorkerBeeTestPlaywright {}

interface IWorkerBeeWorker {
  forEachWorker: void;
}

const envTestFor = <GlobalType extends IWorkerBeeGlobals>(
  page: Page,
  globalFunction: (env: TEnvType) => Promise<GlobalType>,
  isMockEnvironment: boolean = false
): IWorkerBeeTest["workerbeeTest"] => {

  const runner = async<R, Args extends any[]>(checkEqual: boolean, fn: TWorkerBeeTestCallable<R, Args>, ...args: Args): Promise<R> => {

    let nodeData = await fn(await (globalFunction as (...args: any[]) => any)("node"), ...args);

    // Reset mock call counters between node and web test executions to ensure consistent state
    if (isMockEnvironment)
      resetMockCallCounters();

    const webData = await page.evaluate(async({ args: pageArgs, globalFunction: globalFn, webFn, isMockEnv }) => {
      /* eslint-disable no-eval */
      eval(`window.webEvalFn = ${webFn};`);
      eval(`window.isMockEnvironment = ${isMockEnv};`);

      return (window as Window & typeof globalThis & { webEvalFn: (...args: any[]) => any }).webEvalFn(await (globalThis as any)[globalFn]("web"), ...pageArgs);
    }, { args, globalFunction: globalFunction.name, webFn: fn.toString(), isMockEnv: isMockEnvironment });

    if(typeof nodeData === "object") // Remove prototype data from the node result to match webData
      nodeData = JSON.parse(JSON.stringify(nodeData, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value
      ));

    if(checkEqual)
      expect(webData as any).toStrictEqual(nodeData);

    return webData;
  };

  const using = function<R, Args extends any[]>(fn: TWorkerBeeTestCallable<R, Args>, ...args: Args): Promise<R> {
    return runner.bind(undefined, true)(fn as any, ...args) as Promise<R>;
  };
  using.dynamic = runner.bind(undefined, false);

  return using as IWorkerBeeTest["workerbeeTest"];
};

const createWorkerBeeTest = async <T = Record<string, any>>(
  envTestFor: IWorkerBeeTest["workerbeeTest"],
  callback: (bot: QueenBee<{}> | TPastQueen<{}>, resolve: (retVal?: T) => void, reject: (reason?: any) => void, chain?: IHiveChainInterface) => void,
  pastDataFrom?: number,
  pastDataTo?: number,
  dynamic: boolean = false,
  isMockEnvironment: boolean = false,
  shouldHaveFullWorkerBeeInterface: boolean = false
): Promise<T> => {
  const testRunner = dynamic ? envTestFor.dynamic : envTestFor;

  return await testRunner(async ({ WorkerBee, bot: workerBeeBot, wax }, callbackStr, pastFrom, pastTo, isMock, shouldHaveFullWorkerBeeInterfaceParam) => {
    let bot = workerBeeBot;

    if (isMock) {
      const chain = await wax.createHiveChain({
        apiEndpoint: "http://localhost:8000",
        apiTimeout: 0
      });

      bot = new WorkerBee(chain);
    }

    bot.start();

    let finalBot: IWorkerBee | TPastQueen<{}>;

    if (!isMock && pastFrom && pastTo)
      finalBot = bot.providePastOperations(pastFrom, pastTo) as unknown as TPastQueen<{}>;
    else if (shouldHaveFullWorkerBeeInterfaceParam)
      finalBot = bot as unknown as IWorkerBee;
    else
      finalBot = bot.observe as unknown as QueenBee<{}>;

    const returnValue = await new Promise<T>((resolve, reject) => {
      // Reconstruct callback from string in web environment
      const reconstructedCallback = eval(`(${callbackStr})`);
      reconstructedCallback(finalBot, resolve, reject, bot.chain);
    });

    bot.stop();
    bot.delete();

    return returnValue;
  }, callback.toString(), pastDataFrom, pastDataTo, isMockEnvironment, shouldHaveFullWorkerBeeInterface);
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
    use((callback, pastDataFrom, pastDataTo, dynamic) => createWorkerBeeTest(workerbeeTest, callback, pastDataFrom, pastDataTo, dynamic));
  }
});

export const mockTest = base.extend<IWorkerBeeTest, IWorkerBeeWorker>({
  forEachTest: [async ({ page }, use) => {
    page.on("console", (msg: ConsoleMessage) => {
      console.log(">>", msg.type(), msg.text());
    });

    await page.goto("http://localhost:8080/__tests__/assets/test.html", { waitUntil: "load" });

    /* Reset mock call counters for progressive responses */
    resetMockCallCounters();

    await use();
  }, { auto: true }],

  forEachWorker: [async ({ browser }, use) => {
    const closeServer = await createServer(new JsonRpcMock(jsonRpcMockData), 8000);

    await use();

    await browser.close();
    await closeServer();
  }, { scope: "worker", auto: true }],

  createMockWorkerBeeTest: ({ page }, use) => {
    const mockEnvTestFor = envTestFor(page, createTestFor, true);
    // TODO: Improve types to not cast to `any`
    use(
      (
        callback,
        dynamic,
        shouldHaveFullWorkerBeeInterface
      ) => createWorkerBeeTest(mockEnvTestFor, callback as any, undefined, undefined, dynamic, true, shouldHaveFullWorkerBeeInterface)
    );
  }
});
