import { expect } from "@playwright/test";

import type {
  DataEvaluationContext,
  TFilterEvaluationContext,
  TProviderEvaluationContext
} from "../../src/chain-observers/factories/data-evaluation-context";
import { FactoryBase } from "../../src/chain-observers/factories/factory-base";
import { FilterBase } from "../../src/chain-observers/filters/filter-base";
import { ObserverMediator } from "../../src/chain-observers/observer-mediator";
import { ProviderBase } from "../../src/chain-observers/providers/provider-base";
import { test } from "../assets/jest-helper";

class NotifyFactory extends FactoryBase {
  public readonly events: string[] = [];

  public preNotify(_context: DataEvaluationContext, _mediator: ObserverMediator): Promise<boolean> {
    this.events.push("pre");

    return Promise.resolve(true);
  }

  public postNotify(_context: DataEvaluationContext, _mediator: ObserverMediator): Promise<void> {
    this.events.push("post");

    return Promise.resolve();
  }
}

class RecordingFilter extends FilterBase {
  private readonly events: string[];

  public constructor(events: string[]) {
    super();

    this.events = events;
  }

  public match(_data: TFilterEvaluationContext): Promise<boolean> {
    this.events.push("filter");

    return Promise.resolve(true);
  }
}

class RecordingProvider extends ProviderBase {
  private readonly events: string[];

  public constructor(events: string[]) {
    super();

    this.events = events;
  }

  public provide(_data: TProviderEvaluationContext): Promise<object> {
    this.events.push("provider");

    return Promise.resolve({ payload: true });
  }
}

test.describe("WorkerBee observer mediator verification", () => {
  test("postNotify waits for listener callbacks to finish", async() => {
    const factory = new NotifyFactory({} as any);
    const mediator = new ObserverMediator(factory);

    mediator.registerListener(
      {
        next() {
          factory.events.push("next-start");

          return new Promise<void>((resolve) => {
            setTimeout(() => {
              factory.events.push("next-end");
              resolve();
            }, 0);
          });
        }
      },
      new RecordingFilter(factory.events),
      [ new RecordingProvider(factory.events) ]
    );

    await mediator.notify();

    expect(factory.events).toEqual([
      "pre",
      "filter",
      "provider",
      "next-start",
      "next-end",
      "post"
    ]);
  });
});
