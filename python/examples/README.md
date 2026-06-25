# WorkerBee Python examples

Python ports of the TypeScript examples from `../examples/`.

## Block parser

**[block_parser.py](block_parser.py)**

Iterates over live blocks using `async for` and logs block id + number.

```bash
python -m examples.block_parser --api-endpoint https://api.hive.blog/
```

## Account observer

**[account_observer.py](account_observer.py)**

Monitors all operations impacting a given account and logs them.

```bash
python -m examples.account_observer --account initminer --api-endpoint https://api.hive.blog/
```

## Post observer

**[post_observer.py](post_observer.py)**

Monitors an account for new posts with full beneficiary settings and votes on them once manabar is full. Voting requires `--private-key` or `HIVE_PRIVATE_KEY`.

```bash
python -m examples.post_observer \
    --account initminer \
    --beneficiary initminer \
    --voter voter \
    --private-key "$HIVE_PRIVATE_KEY" \
    --api-endpoint https://api.hive.blog/
```

## Custom JSON spotter

**[custom_json_spotter.py](custom_json_spotter.py)**

Prints transactions from live blocks that contain a `custom_json_operation`.

```bash
python -m examples.custom_json_spotter --api-endpoint https://api.hive.blog/
```
