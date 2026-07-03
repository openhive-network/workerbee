# Python Examples

The Python examples are runnable CLI scripts under `python/examples/`. They are ports of the browser examples where a Python equivalent exists, plus one Python-only script for spotting `custom_json_operation` transactions in live blocks.

All commands below were validated from the Python package directory with a separate Poetry virtual environment, not the repository `.venv`:

```bash
cd /workspace/workerbee/workerbee/python
unset VIRTUAL_ENV
export POETRY_VIRTUALENVS_IN_PROJECT=false
export POETRY_VIRTUALENVS_PATH=/tmp/workerbee-doc-venvs/examples
poetry install --with docs
poetry env info --path
```

The example scripts are live blockchain observers. The documented commands use `timeout 20s` so they finish during validation. Remove `timeout 20s` when you want the script to keep running until you press Ctrl-C.

## Browser and Docker Setup Difference

The TypeScript examples in `examples/README.md` are browser pages. They are launched with Parcel, import browser bundles from `dist/bundle`, and some of them expect the repository's Docker Compose/testnet helper stack:

- `examples/account-observer/index.html` connects to `http://localhost:3000/`.
- `examples/post-observer/index.html` is configured for a local API endpoint and chain ID.
- `examples/post-observer/wallet.html` is a browser wallet setup page that imports a private posting key before the post observer page runs.

That setup does not apply to the Python examples. The Python examples are command-line modules run with `poetry run python -m examples...`. They use the installed Python packages, connect directly to the API endpoint passed on the command line, and do not use Parcel, browser import maps, `node_modules`, or the Compose proxy. For mainnet validation, use `https://api.hive.blog/` as shown below. If you point a Python example at a local/testnet endpoint, pass the endpoint explicitly; `post_observer.py` is the only Python example here that also accepts `--chain-id`.

The Python post observer also does not need the browser `wallet.html` flow. If signing is enabled, it creates a temporary Beekeeper wallet from `--private-key` or `HIVE_PRIVATE_KEY` for the duration of the process.

## Block Parser

Script: `python -m examples.block_parser`

What it does: iterates over live blocks with `async for` and prints each block ID and block number.

Runtime: long-running live stream.

Configuration:

- Endpoint: `--api-endpoint URL`
- Endpoint default: `HIVE_API_HOST` when set, otherwise `https://api.hive.blog/`
- Private key: not used
- Required environment variables: none

Validated command:

```bash
timeout 20s poetry run python -m examples.block_parser --api-endpoint https://api.hive.blog/
```

Expected output is one line per block, for example `Got block #... (...)`.

## Account Observer

Script: `python -m examples.account_observer`

What it does: monitors operations impacting one account and prints each observer event as formatted JSON.

Runtime: long-running live stream. It may print only the startup line during a short validation window if the selected account has no matching activity.

Configuration:

- Account: `--account NAME`, default `initminer`
- Endpoint: `--api-endpoint URL`
- Endpoint default: `HIVE_API_HOST` when set, otherwise `https://api.hive.blog/`
- Private key: not used
- Required environment variables: none

Validated command:

```bash
timeout 20s poetry run python -m examples.account_observer --account initminer --api-endpoint https://api.hive.blog/
```

Expected startup output is `Observing account: 'initminer'`. Matching account activity is printed as JSON when it appears on chain.

## Post Observer

Script: `python -m examples.post_observer`

What it does: watches an account for new posts, records posts that set the configured beneficiary to 100%, waits for the configured account's upvote manabar to be full, and then attempts to vote.

Runtime: long-running live stream.

Configuration:

- Observed account: `--account NAME`, default `initminer`
- Required beneficiary: `--beneficiary NAME`, default `initminer`
- Voting account: `--voter NAME`, default `voter`
- Endpoint: `--api-endpoint URL`
- Endpoint default: `DIRECT_API_ENDPOINT` when set, otherwise `https://api.hive.blog/`
- Chain ID: optional `--chain-id ID`, default `CHAIN_ID` when set
- Private key: optional `--private-key KEY`, default `HIVE_PRIVATE_KEY` when set

A private key is not required to start the observer. Without one, the script still tracks posts and manabar events, but the vote path logs that voting was skipped. To broadcast real votes, provide a posting private key for the configured voter account through `--private-key` or `HIVE_PRIVATE_KEY`.

Validated command without user secrets:

```bash
timeout 20s poetry run python -m examples.post_observer --account initminer --beneficiary initminer --voter voter --api-endpoint https://api.hive.blog/
```

Expected startup output is `Observing account posts: 'initminer'`.

## Custom JSON Spotter

Script: `python -m examples.custom_json_spotter`

What it does: iterates over live blocks and prints transactions that contain at least one `custom_json_operation`.

Runtime: long-running live stream. On mainnet this usually prints matching transactions quickly, but output still depends on live block contents.

Configuration:

- Endpoint: `--api-endpoint URL`
- Endpoint default: `HIVE_API_HOST` when set, otherwise `https://api.hive.blog/`
- Private key: not used
- Required environment variables: none

Validated command:

```bash
timeout 20s poetry run python -m examples.custom_json_spotter --api-endpoint https://api.hive.blog/
```

Expected output is a printed transaction object whenever a live block contains a `custom_json_operation`.

## Missing Python Examples

- `examples/post-observer/wallet.html` has no standalone Python wallet-manager equivalent. The Python post observer uses a temporary Beekeeper wallet created from `--private-key` or `HIVE_PRIVATE_KEY` instead of a separate browser import step.
- `examples/wordpress-rest-api/` has no Python equivalent under `python/examples/`. The TypeScript example is an Express service that maps Hive posts and comments to WordPress-style REST endpoints under `/wp-json/wp/v2`.
- The root README includes TypeScript scenario snippets without dedicated Python CLI scripts under `python/examples`: whale-transfer monitoring, historical range processing with `providePastOperations`, combined observer chains, and standalone transaction broadcasting.
