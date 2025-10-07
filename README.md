# 🐝 WorkerBee

**A powerful and flexible Hive automation library.**

WorkerBee, based on `wax`, provides a simple yet powerful interface to interact with the Hive blockchain, allowing you to build sophisticated bots and automation scripts with ease.

[![npm version](https://badge.fury.io/js/%40hiveio%2Fworkerbee.svg)](https://badge.fury.io/js/%40hiveio%2Fworkerbee)
[![CI](https://gitlab.syncad.com/hive/workerbee/badges/main/pipeline.svg)](https://gitlab.syncad.com/hive/workerbee/-/pipelines)

---

## ✨ Features

- **No More Endless Loops!** 🔄 Just say what you want to listen to - WorkerBee does all the waiting and event handling behind the scenes.
- **No Blockchain Headaches!** 🧩 Forget complicated APIs and coding tricks. Write logic much like you would on regular web apps (think: “When a new post appears by Alice, send me a ping!”).
- **Keep Your Sandbox Clean** 🧼 WorkerBee shields your code from the messy details of blockchain data, so your app stays flexible and easy-to-maintain.
- **One Interface, Many Sources** 🗃️ Switch from live blockchain data to a historical database or new data source (e.g. SQL) - all without changing your app’s logic!
- **Easy to Expand** 📈 Start simple but add new events, rules, or channels as your needs grow.
- **Fully typed** ℹ️ Library APIs have well defined types and functional interfaces with special support for IDE IntelliSense

---

## 📖 High-level Documentation

You can find the high-level documentation with snippets for this library at [https://hive.pages.syncad.com/workerbee-doc](https://hive.pages.syncad.com/workerbee-doc)

## 🚀 Getting Started

### Installation

This is a [Node.js](https://nodejs.org/en/) module available through the
[npm registry](https://www.npmjs.com/).

Before installing, [download and install Node.js](https://nodejs.org/en/download/).
Node.js 20 or higher is required.

Installation is done using the
[`npm install` command](https://docs.npmjs.com/getting-started/installing-npm-packages-locally):

```bash
npm install @hiveio/workerbee
```

If you want to use development versions of our packages, set `@hiveio` scope to use our GitLab registry:

```bash
echo @hiveio:registry=https://gitlab.syncad.com/api/v4/groups/136/-/packages/npm/ >> .npmrc
npm install @hiveio/workerbee
```

### Basic Usage

Here's a simple example of how to start listening for new blocks on the Hive blockchain:

```typescript
import WorkerBee from "@hiveio/workerbee";

const bot = new WorkerBee();

await bot.start();

console.log("🚀 Bot started! Waiting for new blocks...");

for await (const { id, number } of bot) {
  console.log(`🎉 Got block #${number} with ID: ${id}`);
}
```

---

## 📚 Examples

WorkerBee offers a rich set of observers to monitor various activities on the Hive blockchain. Here are some common use cases:

### Observing New Blocks

You can use an observer to wait for the next block:

```typescript
import WorkerBee from "@hiveio/workerbee";

const bot = new WorkerBee();

await bot.start();

console.log(`⏳ Waiting for new blocks...`);

bot.observe.onBlock().subscribe({
  next(data) {
    console.log(`📦 Block #${data.block.number} detected!`);
  }
});
```

### 👀 Observing Account Activity

Monitor a specific account for new operations:

```typescript
import WorkerBee from "@hiveio/workerbee";

const bot = new WorkerBee();

await bot.start();

console.log("👂 Listening for operations from 'gtg'...");

bot.observe.onImpactedAccounts("gtg").subscribe({
  next(data) {
    console.log("💥 'gtg' was involved in a new transaction!");
    console.log(data.impactedAccounts["gtg"]);
  }
});
```

### 💰 Monitoring for Large Transfers (Whale Watching)

Get notified when large transfers occur:

```typescript
import WorkerBee from "@hiveio/workerbee";

const bot = new WorkerBee();

await bot.start();

// Set a threshold for what you consider a "whale" transfer (e.g., 1000 HIVE)
console.log(`🐋 Watching for transfers larger than 1000 HIVE...`);

const amount = bot.chain!.hiveCoins(1000);

bot.observe.onWhaleAlert(amount).subscribe({
  next(data) {
    data.whaleOperations.forEach(({ operation }) => {
      console.log(
        bot.chain!.waxify`🚨 Whale Alert! ${operation.from} sent ${operation.amount} to ${operation.to}`
      );
    });
  }
});
```

### 📜 Processing Historical Data

You can also process data from a specific range of past blocks. Here's how to find all posts by a specific author in a given block range:

```typescript
import WorkerBee from "@hiveio/workerbee";

const bot = new WorkerBee();
await bot.start();

const author = "gtg";
const startBlock = 96549390;
const endBlock = 96549415;

console.log(`🔍 Searching for posts by @${author} from block ${startBlock} to ${endBlock}...`);

bot.providePastOperations(startBlock, endBlock)
  .onPosts(author)
  .subscribe({
    next(data) {
      data.posts[author]?.forEach(({ operation }) => {
        console.log(`✍️ Found post: @${operation.author}/${operation.permlink}`);
      });
    },
    error: console.error,
    complete() {
      console.log("✅ Search complete.");
    }
  });
```

> [!IMPORTANT]
> `providePastOperations` provides past data to the bot, allowing you to start processing historical operations and directly switch to the live data without losing any context.

### Combining Observers

You can subscribe to multiple events, and the observer will trigger when any of the specified conditions are met. This is useful for monitoring multiple accounts or operations without needing to write complex logic.

When multiple conditions are met at the same time with OR, WorkerBee is smart enough to only trigger the event once, preventing duplicate notifications. Moreover if multiple events occur in the same notification cycle, they will be processed together, ensuring that your logic can account for all relevant changes at once.

WorkerBee by default uses (implicit) OR between filters:

```typescript
import WorkerBee from "@hiveio/workerbee";

const bot = new WorkerBee();
await bot.start();

bot.observe
  .onImpactedAccounts("alice", "bob", "charlie")
  .onPostsWithTags("gtg", "blocktrades")
  .subscribe({
    next(data) {
      // This will trigger if any of the accounts have activity OR if posts are detected with specific author
      console.log(data);
    },
    error: console.error
  });
```

We can also add explicit OR between them:

```diff
  import WorkerBee from "@hiveio/workerbee";

  const bot = new WorkerBee();
  await bot.start();

  bot.observe
    .onImpactedAccounts("alice", "bob", "charlie")
+   .or
    .onPostsWithTags("gtg", "blocktrades")
    .subscribe({
      next(data) {
        // This will trigger if any of the accounts have activity OR if posts are detected with specific author
        console.log(data);
      },
      error: console.error
    });
```

Yyou can also combine multiple observers using the `.and` operator to create more complex conditions, where you can react to any one of several events occurring. The resulting observer will fire if all of the chained conditions are met.

Here's an example of how to get notified when either a specific account's manabar is full AND a new account is created:

```typescript
import { EManabarType } from "@hiveio/wax";
import WorkerBee from "@hiveio/workerbee";

const bot = new WorkerBee();
await bot.start();

console.log("👀 Watching for 'initminer' to have a full RC manabar and for new account...");

bot.observe
  .onAccountsFullManabar(EManabarType.RC, "initminer")
  .and
  .onNewAccount()
  .subscribe({
    next(data) {
      console.log("🔋 'initminer' now has a full RC manabar!");

      data.newAccounts.forEach(({ accountName }) => {
        console.log(`👤 New account created: @${accountName}`);
      });
    },
    error: console.error
  });
```

> [!NOTE]
> AND takes precedence over OR, so you can chain multiple `.and` calls to create complex conditions

```typescript
import { EManabarType } from "@hiveio/wax";
import WorkerBee from "@hiveio/workerbee";

const bot = new WorkerBee();
await bot.start();

bot.observe
  .onAccountsFullManabar(EManabarType.RC, "initminer")
    .or
    .onAccountsBalanceChange(false, "initminer")
  .and
  .onNewAccount()
  .subscribe({
    next() {
      console.log("🔋 'initminer' now has a full RC manabar or balance changed!");
      console.log("👤 Also someone created a new account!");
    },
    error: console.error
  });
```

### 📢 Broadcasting a Transaction

Here's how you can create, sign, and broadcast a transaction:

```typescript
import WorkerBee from "@hiveio/workerbee";

const bot = new WorkerBee();
await bot.start();

console.log("📡 Broadcasting transaction...");

await bot.broadcast(transaction);

console.log("✅ Transaction confirmed by the node!");
```

This will send the transaction to the Hive network and wait for confirmation from the node (transaction applied in the next block).

---

## 📚 Predefined filter categories

WorkerBee provides a set of predefined filter categories to help you easily subscribe to specific types of operations.

You can check the full list of available categories in the [docs/predefined_filter_categories.md](https://gitlab.syncad.com/hive/workerbee/-/blob/main/docs/predefined_filter_categories.md).

## 📖 API Reference

For a detailed API definition, please see our [Wiki](${GEN_DOC_URL}).

## 🛠️ Development and Testing

### Environment Setup

Clone the repository and install the dependencies:

```bash
git clone https://gitlab.syncad.com/hive/workerbee.git
cd workerbee

corepack enable
pnpm install
```

### Build

Compile the TypeScript source code:

```bash
pnpm build
```

### Run Tests

Execute the test suite:

```bash
pnpm test
```

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE.md](https://gitlab.syncad.com/hive/workerbee/-/blob/main/LICENSE.md) file for details.
