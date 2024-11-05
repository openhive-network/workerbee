import { Page, test as base, expect } from "@playwright/test";

import "./globals";
import type { IWorkerBeeGlobals, TEnvType } from "./globals";

type TWorkerBeeTestCallable<R, Args extends any[]> = (globals: IWorkerBeeGlobals, ...args: Args) => (R | Promise<R>);

export interface IWorkerBeeTest {
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
}

const envTestFor = <GlobalType extends IWorkerBeeGlobals>(
  page: Page,
  globalFunction: (env: TEnvType) => Promise<GlobalType>
): IWorkerBeeTest["workerbeeTest"] => {

  const runner = async<R, Args extends any[]>(checkEqual: boolean, fn: TWorkerBeeTestCallable<R, Args>, ...args: Args): Promise<R> => {

    const webData = await page.evaluate(async({ args: pageArgs, globalFunction: globalFn, webFn }) => {
      /* eslint-disable no-eval */
      eval(`window.webEvalFn = ${webFn};`);

      return (window as Window & typeof globalThis & { webEvalFn: (...args: any[]) => any }).webEvalFn(await globalThis[globalFn]("web"), ...pageArgs);
    }, { args, globalFunction: globalFunction.name, webFn: fn.toString() });
    let nodeData = await fn(await (globalFunction as (...args: any[]) => any)("node"), ...args);

    if(typeof nodeData === "object") // Remove prototype data from the node result to match webData
      nodeData = JSON.parse(JSON.stringify(nodeData));

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

export const test = base.extend<IWorkerBeeTest>({
  workerbeeTest: ({ page }, use) => {
    use(envTestFor(page, createTestFor));
  }
});
