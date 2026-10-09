import { z } from "zod";

/** Canonical provider ids known to the registry. */
export const providerIdSchema = z.enum(["exa", "firecrawl", "ceramic", "serper"]);
export type ProviderId = z.infer<typeof providerIdSchema>;

/** Search modes: regular web search vs. news search. */
export const searchModeSchema = z.enum(["web", "news"]);
export type SearchMode = z.infer<typeof searchModeSchema>;

export const normalizedResultSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  snippet: z.string(),
  publishedDate: z.string().optional(),
  extra: z.record(z.string(), z.unknown()).optional(),
});
export type NormalizedResult = z.infer<typeof normalizedResultSchema>;

export const providerResultSchema = z.object({
  status: z.enum(["ok", "error", "timeout"]),
  latencyMs: z.number(),
  results: z.array(normalizedResultSchema),
  error: z.string().optional(),
});
export type ProviderResult = z.infer<typeof providerResultSchema>;

export const providerMetaSchema = z.object({
  id: z.string(),
  name: z.string(),
  tagline: z.string(),
  docsUrl: z.string(),
  /** Secret name (e.g. "EXA_API_KEY") — static config, not secret material. */
  envKey: z.string(),
  /** Search modes this provider supports. */
  modes: z.array(searchModeSchema),
  configured: z.boolean(),
});
export type ProviderMeta = z.infer<typeof providerMetaSchema>;

const dimensionScoresSchema = z.object({
  providerId: z.string(),
  relevance: z.number().min(0).max(100),
  freshness: z.number().min(0).max(100),
  depth: z.number().min(0).max(100),
  sourceQuality: z.number().min(0).max(100),
  snippetUsefulness: z.number().min(0).max(100),
});

export const judgeOutputSchema = z.object({
  model: z.string(),
  ranking: z.array(z.string()),
  overall: z.array(
    z.object({
      providerId: z.string(),
      score: z.number().min(0).max(100),
      verdict: z.string(),
    }),
  ),
  dimensions: z.array(dimensionScoresSchema),
  strengths: z.array(
    z.object({ providerId: z.string(), points: z.array(z.string()) }),
  ),
  weaknesses: z.array(
    z.object({ providerId: z.string(), points: z.array(z.string()) }),
  ),
  notes: z.array(z.string()),
});
export type JudgeOutput = z.infer<typeof judgeOutputSchema>;

export const runRequestSchema = z.object({
  query: z.string().min(3).max(500),
  providers: z.array(z.string()).min(1).max(6),
  numResults: z.number().int().min(3).max(10).default(5),
  runJudge: z.boolean().default(true),
  mode: searchModeSchema.default("web"),
});
export type RunRequest = z.infer<typeof runRequestSchema>;

export const runSchema = z.object({
  id: z.string(),
  query: z.string(),
  createdAt: z.string(),
  numResults: z.number(),
  mode: searchModeSchema,
  providerRuns: z.record(z.string(), providerResultSchema),
  judge: judgeOutputSchema.optional(),
  judgeError: z.string().optional(),
});
export type Run = z.infer<typeof runSchema>;

export const historyItemSchema = z.object({
  id: z.string(),
  query: z.string(),
  providerIds: z.array(z.string()),
  createdAt: z.string(),
  mode: searchModeSchema,
  winnerId: z.string().nullable(),
  winnerScore: z.number().nullable(),
});
export type HistoryItem = z.infer<typeof historyItemSchema>;

export const PROVIDER_TIMEOUT_MS = 25_000;
export const MAX_SNIPPET_CHARS = 2000;
export const JUDGE_SNIPPET_CHARS = 800;
