import type { ProviderResult } from "../../shared/schemas";
import { asArray, clean, type SearchProvider } from "./base";

interface ExaItem {
  title?: string;
  url?: string;
  publishedDate?: string;
  highlights?: string[];
  text?: string;
}

/** Exa AI search. Docs: https://docs.exa.ai */
export const exaProvider: SearchProvider = {
  id: "exa",
  name: "Exa",
  tagline: "Neural search over the live web",
  docsUrl: "https://docs.exa.ai",
  envKey: "EXA_API_KEY",
  modes: ["web"],

  async search(query, { numResults, apiKey }): Promise<ProviderResult> {
    const started = Date.now();
    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        query,
        type: "auto",
        numResults,
        contents: { highlights: true, text: { maxCharacters: 1200 } },
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        status: "error",
        latencyMs: Date.now() - started,
        results: [],
        error: `Exa returned HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
      };
    }
    const data = (await res.json()) as { results?: unknown };
    return {
      status: "ok",
      latencyMs: Date.now() - started,
      results: asArray<ExaItem>(data.results).slice(0, numResults).map((r) => ({
        url: r.url ?? "",
        title: r.title ?? r.url ?? "Untitled",
        snippet: clean(r.highlights?.[0] ?? r.text ?? "", 2000),
        ...(r.publishedDate ? { publishedDate: r.publishedDate } : {}),
      })),
    };
  },
};
