import type { ProviderResult, SearchMode } from "../../shared/schemas";
import { clean, type SearchProvider } from "./base";

interface FirecrawlItem {
  title?: string;
  url?: string;
  description?: string;
  markdown?: string;
  publishedDate?: string;
  date?: string;
}

/**
 * Pull results out of a v2/search payload. Current API returns
 * `{ data: { web: [...] } }` for web and `{ data: { news: [...] } }` for the
 * news source (see https://docs.firecrawl.dev/api-reference/endpoint/search);
 * older responses used `{ data: [...] }`. Anything else yields [].
 */
export function extractFirecrawlItems(payload: unknown, mode: SearchMode = "web"): FirecrawlItem[] {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as { data?: unknown }).data;
  if (Array.isArray(data)) return data as FirecrawlItem[];
  if (data && typeof data === "object") {
    const rec = data as { web?: unknown; news?: unknown };
    const pick = mode === "news" ? rec.news : rec.web;
    if (Array.isArray(pick)) return pick as FirecrawlItem[];
    // Tolerate the other source key if the preferred one is absent.
    const fallback = mode === "news" ? rec.web : rec.news;
    if (Array.isArray(fallback)) return fallback as FirecrawlItem[];
  }
  return [];
}

/** Firecrawl search + scrape. Docs: https://docs.firecrawl.dev */
export const firecrawlProvider: SearchProvider = {
  id: "firecrawl",
  name: "Firecrawl",
  tagline: "Search plus full-page markdown",
  docsUrl: "https://docs.firecrawl.dev",
  envKey: "FIRECRAWL_API_KEY",
  modes: ["web", "news"],

  async search(query, { numResults, apiKey, mode }): Promise<ProviderResult> {
    const started = Date.now();
    // News mode uses the dedicated news source (results under data.news).
    const body: Record<string, unknown> =
      mode === "news"
        ? { query, limit: numResults, sources: ["news"] }
        : {
            query,
            limit: numResults,
            scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
          };
    const res = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        status: "error",
        latencyMs: Date.now() - started,
        results: [],
        error: `Firecrawl returned HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
      };
    }
    const payload: unknown = await res.json();
    // Markdown can be huge — truncate server-side before storing/returning.
    return {
      status: "ok",
      latencyMs: Date.now() - started,
      results: extractFirecrawlItems(payload, mode).slice(0, numResults).map((r) => ({
        url: r.url ?? "",
        title: r.title ?? r.url ?? "Untitled",
        snippet: clean(r.description ?? r.markdown ?? "", 2000),
        ...(r.publishedDate || r.date
          ? { publishedDate: r.publishedDate ?? r.date ?? "" }
          : {}),
      })),
    };
  },
};
