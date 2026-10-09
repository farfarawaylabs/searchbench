import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import {
  JUDGE_SNIPPET_CHARS,
  judgeOutputSchema,
  type JudgeOutput,
  type NormalizedResult,
  type SearchMode,
} from "../shared/schemas";
import { truncate } from "./providers/base";

/** Current instruct model on Workers AI (verified against Cloudflare docs
 *  2026-10-09; override with the JUDGE_MODEL secret). */
export const DEFAULT_WORKERS_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const JUDGE_SYSTEM_PROMPT =
  "You are an expert evaluator of web search APIs. You compare result SETS returned " +
  "by different search providers for the same query. Score each provider 0–100 per " +
  "dimension. Be specific and evidence-based: cite result titles/URLs when praising or " +
  "criticizing. Prefer providers whose results directly answer the query with credible, " +
  "diverse, recent sources and useful excerpts. Penalize generic/SEO-farm results, " +
  "duplicates, dead-looking links, and excerpts that don't help decide relevance. " +
  "Be opinionated — ties are allowed only if genuinely deserved.";

export type JudgeBackend = "workers-ai" | "openai" | "anthropic";

export function judgeConfig(env: Env): {
  backend: JudgeBackend;
  model: string;
  envKey: string | null;
} {
  const store = env as unknown as Record<string, string | undefined>;
  const openaiKey = store["JUDGE_OPENAI_API_KEY"];
  const anthropicKey = store["JUDGE_ANTHROPIC_API_KEY"];
  const model = store["JUDGE_MODEL"];
  if (openaiKey) {
    return { backend: "openai", model: model || "gpt-4o-mini", envKey: "JUDGE_OPENAI_API_KEY" };
  }
  if (anthropicKey) {
    return {
      backend: "anthropic",
      model: model || "claude-3-5-haiku-latest",
      envKey: "JUDGE_ANTHROPIC_API_KEY",
    };
  }
  return {
    backend: "workers-ai",
    model: model || DEFAULT_WORKERS_AI_MODEL,
    envKey: null,
  };
}

function buildPrompt(
  query: string,
  inputs: { providerId: string; providerName: string; results: NormalizedResult[] }[],
  mode: SearchMode,
): string {
  const blocks = inputs.map(({ providerId, providerName, results }) => {
    const lines = results.map((r, i) => {
      const date = r.publishedDate ? ` (published: ${r.publishedDate})` : "";
      return `${i + 1}. "${r.title}" — ${r.url}${date}\n   Excerpt: ${truncate(r.snippet, JUDGE_SNIPPET_CHARS)}`;
    });
    return `## Provider "${providerId}" (${providerName})\n${lines.join("\n")}`;
  });
  const modeNote =
    mode === "news"
      ? `Search mode: NEWS. Recency is decisive — reward the freshest directly-relevant coverage from credible outlets, and penalize stale or evergreen filler.\n\n`
      : `Search mode: regular web search.\n\n`;
  return (
    `User query: "${query}"\n\n` +
    modeNote +
    `Compare the following provider result sets. Rank them best → worst in "ranking", ` +
    `score every provider on every dimension, and list strengths/weaknesses with ` +
    `specific evidence.\n\n${blocks.join("\n\n")}`
  );
}

/**
 * Runs the AI judge via the Vercel AI SDK v7 structured-output flow
 * (`generateText` + `Output.object()`, same call shape for Workers AI,
 * OpenAI, and Anthropic). Throws on failure (caller retries once, then
 * stores judgeError). The backend + model are prefixed to every error so a
 * misconfiguration (e.g. an OpenAI model id with no OpenAI key loaded, which
 * silently falls back to Workers AI) is diagnosable from the UI alone.
 */
export async function runJudge(
  env: Env,
  query: string,
  inputs: { providerId: string; providerName: string; results: NormalizedResult[] }[],
  mode: SearchMode = "web",
): Promise<JudgeOutput> {
  const { backend, model } = judgeConfig(env);
  const store = env as unknown as Record<string, string | undefined>;
  const prompt = buildPrompt(query, inputs, mode);
  const output = Output.object({ schema: judgeOutputSchema });

  try {
    if (backend === "openai") {
      const openai = createOpenAI({ apiKey: store["JUDGE_OPENAI_API_KEY"] });
      const { output: result } = await generateText({
        model: openai(model),
        system: JUDGE_SYSTEM_PROMPT,
        prompt,
        output,
      });
      return { ...result, model: `openai:${model}` };
    }
    if (backend === "anthropic") {
      const anthropic = createAnthropic({ apiKey: store["JUDGE_ANTHROPIC_API_KEY"] });
      const { output: result } = await generateText({
        model: anthropic(model),
        system: JUDGE_SYSTEM_PROMPT,
        prompt,
        output,
      });
      return { ...result, model: `anthropic:${model}` };
    }
    const workersai = createWorkersAI({ binding: env.AI });
    const { output: result } = await generateText({
      model: workersai(model),
      system: JUDGE_SYSTEM_PROMPT,
      prompt,
      output,
    });
    return { ...result, model: `workers-ai:${model}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`[judge via ${backend}:${model}] ${message}`);
  }
}
