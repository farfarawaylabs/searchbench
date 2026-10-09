import type { ProviderResult } from "../../shared/schemas";
import { asArray, clean, type SearchProvider } from "./base";

interface SerperOrganic {
  title?: string;
  link?: string;
  snippet?: string;
  position?: number;
}

interface SerperNewsItem {
  title?: string;
  link?: string;
  snippet?: string;
  date?: string;
  source?: string;
  position?: number;
}

/** Narrow `organic[]` web results (legacy-tolerant). */
export function extractSerperOrganic(payload: unknown): SerperOrganic[] {
  if (!payload || typeof payload !== "object") return [];
  return asArray<SerperOrganic>((payload as { organic?: unknown }).organic);
}

/** Narrow `news[]` results. */
export function extractSerperNews(payload: unknown): SerperNewsItem[] {
  if (!payload || typeof payload !== "object") return [];
  return asArray<SerperNewsItem>((payload as { news?: unknown }).news);
}

/**
 * Serper — Google SERP API (2,500 free queries, no card).
 *   Web:  POST https://google.serper.dev/search, body { q, num } → { organic[] }
 *   News: POST https://google.serper.dev/news,    body { q, num } → { news[] }
 * Auth: X-API-KEY header. See https://serper.dev/
 */
export const serperProvider: SearchProvider = {
  id: "serper",
  name: "Serper",
  tagline: "Google results, fastest SERP API",
  docsUrl: "https://serper.dev/",
  envKey: "SERPER_API_KEY",
  modes: ["web", "news"],

  async search(query, { numResults, apiKey, mode }): Promise<ProviderResult> {
    const started = Date.now();
    const endpoint =
      mode === "news" ? "https://google.serper.dev/news" : "https://google.serper.dev/search";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({ q: query, num: numResults }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        status: "error",
        latencyMs: Date.now() - started,
        results: [],
        error: `Serper returned HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
      };
    }
    const payload: unknown = await res.json();
    if (mode === "news") {
      return {
        status: "ok",
        latencyMs: Date.now() - started,
        results: extractSerperNews(payload)
          .slice(0, numResults)
          .map((r) => ({
            url: r.link ?? "",
            title: r.title ?? r.link ?? "Untitled",
            snippet: clean(
              r.snippet ? `${r.snippet}${r.source ? ` — ${r.source}` : ""}` : "",
              2000,
            ),
            ...(r.date ? { publishedDate: r.date } : {}),
          })),
      };
    }
    return {
      status: "ok",
      latencyMs: Date.now() - started,
      results: extractSerperOrganic(payload)
        .slice(0, numResults)
        .map((r) => ({
          url: r.link ?? "",
          title: r.title ?? r.link ?? "Untitled",
          snippet: clean(r.snippet ?? "", 2000),
        })),
    };
  },
};
