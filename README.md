# WorkerBee

Hive automation library based on the wax and beekeeper

## Install

This is a [Node.js](https://nodejs.org/en/) module available through the
[npm registry](https://www.npmjs.com/).

Before installing, [download and install Node.js](https://nodejs.org/en/download/).
Node.js 18 or higher is required.

Installation is done using the
[`npm install` command](https://docs.npmjs.com/getting-started/installing-npm-packages-locally):

```bash
npm install @hiveio/workerbee
```

If you want to use development versions of our packages, set `@hiveio` scope to use our GitLab registry:

```bash
echo @hiveio:registry=https://gitlab.syncad.com/api/v4/packages/npm/ >> .npmrc
npm install @hiveio/workerbee
```

## Usage

Wax is designed to work in web environment by default, so remember to use:

```ts
import '@hiveio/workerbee/node';
```

import when you intend to work in the Node.js environment.

You may need to set `moduleResolution` to `Bundler` in your `tsconfig.json` in order to respect the `exports` fields in our `package.json` file

### Iterating indefinitely over new blocks

```js
import WorkerBee from "@hiveio/workerbee";

const bot = new WorkerBee();
bot.on("error", console.error);

await bot.start();

for await(const { block, number } of bot)
  console.info(`Got block #${block.block_id} (${number})`);
```

### Wait for the next block using observer

```js
import WorkerBee from "@hiveio/workerbee";

const bot = new WorkerBee();
bot.on("error", console.error);

await bot.start();

const block = await new Promise(blockResolve => {
  bot.once("block", blockResolve);
}); // Get one latest block

console.info(`Waiting for block: #${block.number + 1}`);
const observer = bot.observe.block(block.number + 1);

observer.subscribe({
  next() {
    console.info('Block detected');
  }
});
```

### Observe given account for operations in blockchain

```js
import WorkerBee from "@hiveio/workerbee";

const bot = new WorkerBee();
bot.on("error", console.error);

await bot.start();

const observer = bot.observe.accountOperations("gtg");

observer.subscribe({
  next(op) {
    console.info(op);
  }
});
```

### Observe given account for full manabar regeneration

```js
import WorkerBee from "@hiveio/workerbee";

const bot = new WorkerBee();
bot.on("error", console.error);

await bot.start();

const observer = bot.observe.accountFullManabar("gtg");

observer.subscribe({
  next(acc) {
    console.info(acc.voting_manabar); // { "current_mana": "0", "last_update_time": 0 }
  }
});
```

### Broadcast and observe transaction in blockchain

```js
import WorkerBee from "@hiveio/workerbee";
import beekeeperFactory from "@hiveio/beekeeper";

const beekeeper = await beekeeperFactory();
const session = await beekeeper.createSession("my.salt");
const { wallet } = await session.createWallet("w0", "mypassword");
await wallet.importKey("5JkFnXrLM2ap9t3AmAxBJvQHF7xSKtnTrCTginQCkhzU5S7ecPT");

const bot = new WorkerBee();
bot.on("error", console.error);

await bot.start();

// Build transaction
const builder = await bot.chain.getTransactionBuilder();
builder.push({
  vote: {
    voter: "otom",
    author: "c0ff33a",
    permlink: "ewxhnjbj",
    weight: 2200
  }
});

// Broadcast our transaction with custom internal expiration time
const observer = await bot.broadcast(builder.build(wallet, "5RqVBAVNp5ufMCetQtvLGLJo7unX9nyCBMMrTXRWQ9i1Zzzizh"));

// Observe if our transaction has been applied
observer.subscribe({
  next(tx) {
    console.info(tx, "applied in blockchain");
  },
  error() {
    console.error("Transaction observation time expired");
  }
});
```

## API

See API definition in our [Wiki](https://gitlab.syncad.com/hive/workerbee/-/wikis/home)

## Support and tests

Tested on the latest Chromium (v117) and Node.js v18.19.0

[Automated CI test](https://gitlab.syncad.com/hive/workerbee/-/pipelines) runs are available.

To run the tests on your own, clone the Wax repo and install the dependencies and then compile the project:

```bash
sudo npm install -g pnpm
pnpm install
```

Compile source:

```bash
npm run build
```

Then run tests:

```bash
npm run test
```

## License

See license in the [LICENSE.md](https://gitlab.syncad.com/hive/workerbee/-/blob/${CommitSHA}/LICENSE.md) file
