# SearchBench

Run one query against every AI search provider, compare the results side by side,
and let an AI judge score, rank, and critique each result set.

![SearchBench](docs/screenshot.png)
<!-- Screenshot placeholder: replace `docs/screenshot.png` with a real capture of the Compare page. -->

## What it is

A personal, single-user web app for comparing AI search providers
([Exa](https://exa.ai), [Firecrawl](https://www.firecrawl.dev),
[Ceramic.ai](https://ceramic.ai)):

1. **Manual comparison** — every provider's results side by side for human review.
2. **AI judge** — an LLM scores five dimensions (relevance, freshness, depth,
   source quality, snippet usefulness), ranks providers, and writes
   strengths/weaknesses with evidence.

React + Vite SPA (`src/`) with a Workers API (`worker/`) serving `/api/*`,
persisted to D1.

## Quickstart

```bash
npm install
cp .dev.vars.example .dev.vars   # then fill in at least two provider keys
npm run db:migrate:local          # create the local D1 tables
npm run dev                       # app loads (providers show configured/missing)
```

Run a comparison: enter a query on `/`, pick providers, hit **Run comparison**.

### Deploy

```bash
npx wrangler d1 create searchbench   # copy the database_id into wrangler.jsonc
```

`wrangler.jsonc` ships with `account_id` set to the owner's personal account
(found via `npx wrangler whoami` showing two accounts). If this project should
live under a different account (e.g. Popcorn), change `account_id` — local dev
and deploy both need it to resolve the account non-interactively.

```bash
npx wrangler secret put EXA_API_KEY
npx wrangler secret put FIRECRAWL_API_KEY
npx wrangler secret put CERAMIC_API_KEY
npm run deploy                       # build + apply D1 migrations + deploy
```

The app serves at `*.workers.dev`. `compatibility_date` is the scaffold date.

> Publishing publicly? There is no login in v1 — put the app behind
> [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/).

## Key setup

| Secret | Provider |
| --- | --- |
| `EXA_API_KEY` | Exa (`x-api-key` header, web only) |
| `FIRECRAWL_API_KEY` | Firecrawl (`Authorization: Bearer`, web + news via `sources: ["news"]`) |
| `CERAMIC_API_KEY` | Ceramic (`Authorization: Bearer`, `POST https://api.ceramic.ai/search`, web only) |
| `SERPER_API_KEY` | Serper (`X-API-KEY`, `POST google.serper.dev/search` + `/news`, web + news) |

The Compare page has two tabs: **Regular search** (all configured web providers)
and **News search** (Serper vs. Firecrawl news). Runs store their `mode`, shown
in history and replay; the judge weighs recency more heavily in news mode.

Provider API keys **never touch the client** — all provider calls happen in the
Worker. `/api/providers` returns `{ id, name, tagline, configured, docsUrl }`
only (plus the non-secret `envKey` name so Settings can tell you what to set).

## Judge model config

Default: Workers AI binding, model `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
(a current instruct model per Cloudflare docs; override any time):

```bash
npx wrangler secret put JUDGE_MODEL   # e.g. @cf/meta/llama-4-scout-17b-16e-instruct
```

BYOK override — set one key secret (OpenAI wins if both are set):

```bash
npx wrangler secret put JUDGE_OPENAI_API_KEY
# and optionally JUDGE_MODEL (default gpt-4o-mini)
npx wrangler secret put JUDGE_ANTHROPIC_API_KEY
# and optionally JUDGE_MODEL (default claude-3-5-haiku-latest)
```

The judge uses the Vercel AI SDK v7 structured-output flow (`generateText` +
`Output.object()` with a Zod schema, same call shape for Workers AI, OpenAI,
and Anthropic). On failure it retries once, then stores a graceful
`judgeError` state in the UI — the error names the backend + model attempted
(e.g. `[judge via workers-ai:...]` means your BYOK key wasn't loaded and the
judge fell back to Workers AI; restart dev after editing `.dev.vars`).

## Adding a provider (3 steps)

1. Create `worker/providers/<id>.ts` exporting a `SearchProvider`
   (`search()` returning normalized `{ url, title, snippet, publishedDate? }`).
2. Add one line to the map in `worker/providers/index.ts`.
3. Add `<ENV_KEY>=` to `.dev.vars.example` and a row to the table above.

Suggested next adapters: Tavily, Brave Search, Linkup, Perplexity Sonar, and
Cloudflare's own Web Search API.

## API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/providers` | metadata + `configured` booleans, no secrets |
| POST | `/api/run` | `{ query, providers, numResults?, runJudge?, mode? }` → `{ run }` (`mode`: `web` default, `news`; providers must support it) |
| POST | `/api/run/stream` | same body → SSE: `provider` → `saved` → `judge` → `done` (results render as they arrive) |
| POST | `/api/runs/:id/judge` | re-judge a stored run |
| GET | `/api/history?limit=` | run summaries with winner badge |
| GET | `/api/runs/:id` | full run incl. results + judge |
| DELETE | `/api/runs/:id` | delete a run |
| GET | `/api/runs/:id/export.md` | Markdown report download |
| GET | `/api/settings` | judge backend/model (no key values) |

Provider calls fan out in parallel; one provider failing never fails the run
(per-provider timeout: 25s → `status: "timeout"`). The judge only runs when
≥2 providers returned results.

## No-secrets check

Key *names* (`EXA_API_KEY`, …) intentionally appear in the client bundle — they
are UI copy in Settings ("run `wrangler secret put EXA_API_KEY`"). Key
*values* must never appear there: values are only read from Worker secrets via
`env` at runtime, and the client never imports `worker/`. Verify after a build
with real keys in `.dev.vars`/secrets:

```bash
# shows only UI-copy hits like "secret put EXA_API_KEY" — no values
grep -o ".\{40\}EXA_API_KEY.\{40\}" dist/client/assets/*.js
```

## Tech

Cloudflare Workers + React/Vite SPA (`@cloudflare/vite-plugin`), Tailwind v4,
TanStack Router + Query, Zod (shared `shared/` schemas), Hono, Vercel AI SDK
(`ai` + `workers-ai-provider`), D1. TypeScript strict, no `any` without comment.

Focused tests live in `tests/` — run with `npm test` (vitest).

MIT — see [LICENSE](LICENSE).
