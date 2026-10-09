-- SearchBench runs history (D1).
-- Applied with: wrangler d1 migrations apply searchbench [--remote]

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  provider_ids TEXT NOT NULL,   -- JSON array of provider ids
  num_results INTEGER NOT NULL,
  results TEXT NOT NULL,        -- JSON: Record<providerId, ProviderResult>
  judge TEXT,                   -- JSON: JudgeOutput, nullable
  judge_error TEXT,             -- human-readable judge failure, nullable
  created_at TEXT NOT NULL      -- ISO timestamp
);

CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs (created_at DESC);
