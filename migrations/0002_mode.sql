-- Search mode per run ("web" | "news"). Old rows default to "web".
-- Applied with: wrangler d1 migrations apply searchbench [--remote]

ALTER TABLE runs ADD COLUMN mode TEXT NOT NULL DEFAULT 'web';
