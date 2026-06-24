import { expect } from "@playwright/test";

import { AccountClassifier } from "../../src/chain-observers/classifiers";
import type { TFilterEvaluationContext } from "../../src/chain-observers/factories/data-evaluation-context";
import { AccountMetadataChangeFilter } from "../../src/chain-observers/filters/account-metadata-change-filter";
import { BalanceChangeFilter } from "../../src/chain-observers/filters/balance-change-filter";
import { test } from "../assets/jest-helper";

type TBalance = Record<string, Record<string, { amount: string }>>;
type TAccount = {
  balance?: TBalance;
  jsonMetadata?: object;
  postingJsonMetadata?: object;
};

const makeBalance = (hiveTotal: string, hbdTotal: string, hpTotal: string): TBalance => ({
  HIVE: {
    liquid: { amount: hiveTotal },
    total: { amount: hiveTotal }
  },
  HBD: {
    liquid: { amount: hbdTotal },
    total: { amount: hbdTotal }
  },
  HP: {
    liquid: { amount: hpTotal },
    total: { amount: hpTotal }
  }
});

const makeAccountContext = (accounts: Record<string, TAccount>): TFilterEvaluationContext => ({
  get(classifier: typeof AccountClassifier): Promise<{ accounts: Record<string, TAccount> }> {
    expect(classifier).toBe(AccountClassifier);

    return Promise.resolve({ accounts });
  },
  query(): Promise<never> {
    throw new Error("stateful account filters must not call query");
  },
  accessStore(): object {
    return {};
  }
}) as TFilterEvaluationContext;

test.describe("WorkerBee stateful account filters verification", () => {
  test("BalanceChangeFilter tracks previous balances per account", async() => {
    const filter = new BalanceChangeFilter([ "alice", "bob" ]);
    const context = makeAccountContext({
      alice: { balance: makeBalance("1000", "500", "2000") },
      bob: { balance: makeBalance("3000", "700", "4000") }
    });

    await expect(filter.match(context)).resolves.toBe(false);
    await expect(filter.match(context)).resolves.toBe(false);
  });

  test("BalanceChangeFilter internal-transfer mode checks later accounts", async() => {
    const filter = new BalanceChangeFilter([ "alice", "bob" ], true);
    const before = makeAccountContext({
      alice: { balance: makeBalance("1000", "500", "2000") },
      bob: { balance: makeBalance("3000", "700", "4000") }
    });
    const after = makeAccountContext({
      alice: { balance: makeBalance("1000", "500", "2000") },
      bob: { balance: makeBalance("3001", "700", "4000") }
    });

    await expect(filter.match(before)).resolves.toBe(false);
    await expect(filter.match(after)).resolves.toBe(true);
  });

  test("AccountMetadataChangeFilter tracks previous metadata per account", async() => {
    const filter = new AccountMetadataChangeFilter([ "alice", "bob" ]);
    const context = makeAccountContext({
      alice: {
        jsonMetadata: { profile: { name: "Alice" } },
        postingJsonMetadata: { app: "one" }
      },
      bob: {
        jsonMetadata: { profile: { name: "Bob" } },
        postingJsonMetadata: { app: "two" }
      }
    });

    await expect(filter.match(context)).resolves.toBe(false);
    await expect(filter.match(context)).resolves.toBe(false);
  });
});
