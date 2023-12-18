# WorkerBee examples

This directory exists for the purpose of demonstrating how to run our scripts in the browser environment as a bundle

## Prepare WorkerBee docker-compose stack

First install required tools:

```bash
sudo apt-get install docker.io
```

and **docker-compose** following [this tutorial](https://docs.docker.com/engine/install/ubuntu/#install-using-the-repository)

Before starting compose stack, you have to:

1. update hive submodule by running:

    ```bash
    # Initialize submodules
    git submodule update --init --recursive
    ```

2. Build a testnet instance, being a base for the one created by compose stack (you have to be in the project root directory):

    ```bash
    # Build docker image
    ./examples/hive/scripts/ci-helpers/build_instance.sh --hive-subdir=examples/hive --network-type=testnet infinite-post-creator ./examples/hive registry.gitlab.syncad.com/hive/hive
    ```

3. Start compose stack by spawning a helper script:

    ```bash
    # Start compose stack
    ./examples/start.sh
    ```

    > If you would like to force helper images rebuild (except the one created in step #2) you can additionally pass `--build` option to the `start.sh` script.

## Examples

After configuring the docker-compose stack you can run our examples with the custom chain or the mainnet version (depending on the example type):

### Block parser

**[block-parser/index.html](block-parser/index.html)**

Block parser explains how to parse and display block info from the remote using our libraries

```bash
# Run example
pnpm dlx parcel block-parser/index.html
```

### Account observer

**[account-observer/index.html](account-observer/index.html)**

Account observer explains how to observe given account on the blockchain using our libraries

```bash
# Run example
pnpm dlx parcel account-observer/index.html
```

### Post observer

Run the wallet manager first, create wallet and import key, then run the `index.html` page

**[post-observer/wallet.html](post-observer/wallet.html)**

Wallet manager for post observer creates wallet and imports keys for given account using our libraries

```bash
# Run example
pnpm dlx parcel post-observer/wallet.html
```

**[post-observer/index.html](post-observer/index.html)**

Post observer explains how to observe given account for new posts and automatically vote on them on the blockchain using our libraries

```bash
# Run example
pnpm dlx parcel post-observer/index.html
```
