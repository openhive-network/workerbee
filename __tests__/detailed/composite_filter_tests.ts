import { expect } from "@playwright/test";

import type { TFilterEvaluationContext } from "../../src/chain-observers/factories/data-evaluation-context";
import { LogicalOrFilter } from "../../src/chain-observers/filters/composite-filter";
import { FilterBase } from "../../src/chain-observers/filters/filter-base";
import { test } from "../assets/jest-helper";

class StaticFilter extends FilterBase {
  public callCount = 0;
  private readonly result: boolean;

  public constructor(result: boolean) {
    super();

    this.result = result;
  }

  public match(_data: TFilterEvaluationContext): Promise<boolean> {
    ++this.callCount;

    return Promise.resolve(this.result);
  }
}

test.describe("WorkerBee composite filter verification", () => {
  test("LogicalOrFilter returns false when every operand is false", async() => {
    const first = new StaticFilter(false);
    const second = new StaticFilter(false);
    const filter = new LogicalOrFilter([ first, second ]);

    await expect(filter.match({} as TFilterEvaluationContext)).resolves.toBe(false);
    expect(first.callCount).toBe(1);
    expect(second.callCount).toBe(1);
  });

  test("LogicalOrFilter stops after the first true operand", async() => {
    const first = new StaticFilter(true);
    const second = new StaticFilter(false);
    const filter = new LogicalOrFilter([ first, second ]);

    await expect(filter.match({} as TFilterEvaluationContext)).resolves.toBe(true);
    expect(first.callCount).toBe(1);
    expect(second.callCount).toBe(0);
  });
});
