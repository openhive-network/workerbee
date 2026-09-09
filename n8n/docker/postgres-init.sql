-- Schema for the example workflow in ../workflows/gtg-busy-blocks.json.
--
-- Runs once, when the postgres volume is first created; postgres executes
-- everything in /docker-entrypoint-initdb.d on an empty data directory only.
-- Dropping the volume (`docker compose down -v`) is what re-runs it.

CREATE TABLE IF NOT EXISTS block_transactions (
  block_num      BIGINT      NOT NULL,
  transaction_id TEXT        NOT NULL,
  seen_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A block can be delivered twice: the workflow is re-activated, or n8n is
  -- restarted while the same block is in flight. The pair is what identifies a
  -- row, so a repeat is a conflict rather than a duplicate.
  PRIMARY KEY (block_num, transaction_id)
);

-- The question this table exists to answer is "what did gtg produce lately",
-- which reads by block in descending order.
CREATE INDEX IF NOT EXISTS block_transactions_block_num_idx ON block_transactions (block_num DESC);
