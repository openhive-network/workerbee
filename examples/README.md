# WorkerBee examples

This directory exists for the purpose of demonstrating how to run our scripts in the browser environment as a bundle

## Block parser

**[block-parser/index.html](block-parser/index.html)**

Block parser explains how to parse and display block info from the remote using our libraries

```bash
# Run example
pnpm dlx parcel block-parser/index.html
```

## Account observer

**[account-observer/index.html](account-observer/index.html)**

Account observer explains how to observe given account on the blockchain using our libraries

```bash
# Run example
pnpm dlx parcel account-observer/index.html
```

## Post observer

**[post-observer/index.html](post-observer/index.html)**

Post observer explains how to observe given account for new posts and automatically vote on them on the blockchain using our libraries

```bash
# Run example
pnpm dlx parcel post-observer/index.html
```

# Starting WorkerBee examples using provided docker compose stack

Before starting compose stack, you have to:
1. update hive submodule by running:
``` bash
git submodule update --init --recursive
```
2. Build a testnet instance, being a base for the one created by compose stack:
```bash
cd examples
./hive/scripts/ci-helpers/build_instance.sh --network-type=testnet infinite-post-creator ./hive registry.gitlab.syncad.com/hive/hive
```
3. Start compose stack by spawning a helper script:
```bash
./examples/start.sh
```
If you would like to force helper images rebuild (except the one created in step #2) you can additionally pass `--build` option to the `start.sh` script.


