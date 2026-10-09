import type { ProviderResult } from "../../shared/schemas";
import { asArray, clean, type SearchProvider } from "./base";

interface CeramicItem {
  title?: string;
  url?: string;
  description?: string;
  publishedDate?: string;
}

interface CeramicResponse {
  result?: { results?: CeramicItem[] };
  results?: CeramicItem[];
}

/**
 * Ceramic.ai — AI-native search over an independent web index.
 * Implemented against the live docs (2026-10-09):
 *   POST https://api.ceramic.ai/search
 *   Authorization: Bearer <CERAMIC_API_KEY>
 *   Body: { query, maxResults, maxDescriptionLength }
 * See https://docs.ceramic.ai/api-reference/search.md
 */
export const ceramicProvider: SearchProvider = {
  id: "ceramic",
  name: "Ceramic",
  tagline: "AI-native search, independent index",
  docsUrl: "https://docs.ceramic.ai",
  envKey: "CERAMIC_API_KEY",
  modes: ["web"],

  async search(query, { numResults, apiKey }): Promise<ProviderResult> {
    const started = Date.now();
    const res = await fetch("https://api.ceramic.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        maxResults: numResults,
        maxDescriptionLength: 1200,
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        status: "error",
        latencyMs: Date.now() - started,
        results: [],
        error: `Ceramic returned HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
      };
    }
    const data = (await res.json()) as CeramicResponse;
    const nested = asArray<CeramicItem>(data.result?.results);
    const items = nested.length > 0 ? nested : asArray<CeramicItem>(data.results);
    return {
      status: "ok",
      latencyMs: Date.now() - started,
      results: items.slice(0, numResults).map((r) => ({
        url: r.url ?? "",
        title: r.title ?? r.url ?? "Untitled",
        snippet: clean(r.description ?? "", 2000),
        ...(r.publishedDate ? { publishedDate: r.publishedDate } : {}),
      })),
    };
  },
};
