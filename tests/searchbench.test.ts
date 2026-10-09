import { afterEach, describe, expect, it, vi } from "vitest";
import { runRequestSchema, type Run } from "../shared/schemas";
import { runToMarkdown } from "../worker/export";
import { getProvider, listProviders } from "../worker/providers";
import { exaProvider } from "../worker/providers/exa";
import { extractFirecrawlItems } from "../worker/providers/firecrawl";
import { judgeConfig } from "../worker/judge";
import {
  extractSerperNews,
  extractSerperOrganic,
} from "../worker/providers/serper";
import { feedSse } from "../src/lib/api";

describe("provider registry", () => {
  it("ships exa, firecrawl, ceramic, and serper with unique ids and env keys", () => {
    const ids = listProviders().map((p) => p.id).sort();
    expect(ids).toEqual(["ceramic", "exa", "firecrawl", "serper"]);
    const envKeys = listProviders().map((p) => p.envKey);
    expect(new Set(envKeys).size).toBe(envKeys.length);
    for (const p of listProviders()) {
      expect(getProvider(p.id)).toBe(p);
      expect(p.docsUrl).toMatch(/^https:\/\//);
    }
  });

  it("returns undefined for unknown ids", () => {
    expect(getProvider("nope")).toBeUndefined();
  });

  it("declares news support for exa, serper, and firecrawl", () => {
    const news = listProviders()
      .filter((p) => p.modes.includes("news"))
      .map((p) => p.id)
      .sort();
    expect(news).toEqual(["exa", "firecrawl", "serper"]);
    for (const p of listProviders()) expect(p.modes).toContain("web");
  });
});

describe("run request validation", () => {
  it("accepts a well-formed run", () => {
    const parsed = runRequestSchema.safeParse({
      query: "is this working?",
      providers: ["exa", "ceramic"],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.numResults).toBe(5);
      expect(parsed.data.runJudge).toBe(true);
      expect(parsed.data.mode).toBe("web");
    }
  });

  it("accepts a news-mode run", () => {
    const parsed = runRequestSchema.safeParse({
      query: "latest news here",
      providers: ["serper", "firecrawl"],
      mode: "news",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.mode).toBe("news");
  });

  it("rejects short queries and unknown shapes", () => {
    expect(
      runRequestSchema.safeParse({ query: "ab", providers: ["exa"] }).success,
    ).toBe(false);
    expect(
      runRequestSchema.safeParse({ query: "valid query here", providers: [] })
        .success,
    ).toBe(false);
  });
});

describe("firecrawl response shapes", () => {
  const web = [
    { url: "https://example.com/a", title: "A", description: "Desc A" },
    { url: "https://example.com/b", title: "B", description: "Desc B" },
  ];

  it("reads the current { data: { web: [...] } } object form", () => {
    expect(extractFirecrawlItems({ success: true, data: { web } })).toEqual(web);
  });

  it("still reads the legacy { data: [...] } array form", () => {
    expect(extractFirecrawlItems({ success: true, data: web })).toEqual(web);
  });

  it("returns [] for non-web payloads instead of crashing", () => {
    expect(extractFirecrawlItems({ success: true, data: { research: [] } })).toEqual([]);
    expect(extractFirecrawlItems({ success: true })).toEqual([]);
    expect(extractFirecrawlItems(null)).toEqual([]);
  });

  it("reads data.news in news mode", () => {
    const news = [{ url: "https://example.com/n", title: "N", description: "D" }];
    expect(extractFirecrawlItems({ success: true, data: { news } }, "news")).toEqual(news);
  });
});

describe("serper response shapes", () => {
  it("reads organic[] web results", () => {
    const organic = [
      { title: "A", link: "https://example.com/a", snippet: "Desc", position: 1 },
    ];
    expect(extractSerperOrganic({ organic })).toEqual(organic);
    expect(extractSerperOrganic({})).toEqual([]);
    expect(extractSerperOrganic(null)).toEqual([]);
  });

  it("reads news[] results", () => {
    const news = [
      {
        title: "N",
        link: "https://example.com/n",
        snippet: "S",
        date: "2 weeks ago",
        source: "Example",
        position: 1,
      },
    ];
    expect(extractSerperNews({ news })).toEqual(news);
    expect(extractSerperNews({ organic: [] })).toEqual([]);
  });
});

describe("exa news mode", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends category news on the same /search endpoint in news mode only", async () => {
    const seen: { url: unknown; body: Record<string, unknown> }[] = [];
    vi.stubGlobal(
      "fetch",
      async (url: unknown, init?: { body?: unknown }) => {
        seen.push({
          url,
          body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
        });
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      },
    );

    await exaProvider.search("latest AI news", { numResults: 5, apiKey: "k", mode: "news" });
    await exaProvider.search("latest AI news", { numResults: 5, apiKey: "k", mode: "web" });

    expect(seen).toHaveLength(2);
    expect(seen[0].url).toBe("https://api.exa.ai/search");
    expect(seen[0].body.category).toBe("news");
    expect(seen[1].body).not.toHaveProperty("category");
  });
});

describe("judge backend selection", () => {
  const env = (vars: Record<string, string>) => vars as unknown as Env;

  it("uses OpenAI when its key is set, with model override", () => {
    expect(
      judgeConfig(env({ JUDGE_OPENAI_API_KEY: "sk-x", JUDGE_MODEL: "gpt-x" })),
    ).toEqual({ backend: "openai", model: "gpt-x", envKey: "JUDGE_OPENAI_API_KEY" });
  });

  it("prefers OpenAI over Anthropic and defaults models", () => {
    expect(
      judgeConfig(env({ JUDGE_OPENAI_API_KEY: "sk-x", JUDGE_ANTHROPIC_API_KEY: "sk-y" }))
        .backend,
    ).toBe("openai");
    expect(judgeConfig(env({ JUDGE_ANTHROPIC_API_KEY: "sk-y" }))).toEqual({
      backend: "anthropic",
      model: "claude-3-5-haiku-latest",
      envKey: "JUDGE_ANTHROPIC_API_KEY",
    });
  });

  it("falls back to Workers AI with no BYOK key (check /api/settings!)", () => {
    const cfg = judgeConfig(env({ JUDGE_MODEL: "gpt-x" }));
    expect(cfg.backend).toBe("workers-ai");
    expect(cfg.envKey).toBeNull();
  });
});

describe("SSE frame parser", () => {
  it("parses complete frames and holds back partial ones", () => {
    const first = feedSse('event: provider\ndata: {"a":1}\n\nevent: jud');
    expect(first.events).toEqual([{ event: "provider", data: '{"a":1}' }]);
    const second = feedSse(`${first.rest}ge\ndata: {"b":2}\n\n`);
    expect(second.events).toEqual([{ event: "judge", data: '{"b":2}' }]);
    expect(second.rest).toBe("");
  });

  it("ignores frames without data", () => {
    expect(feedSse("event: ping\n\n").events).toEqual([]);
  });
});

describe("markdown export", () => {
  const run: Run = {
    id: "abc123",
    query: "test query",
    createdAt: "2026-10-09T00:00:00.000Z",
    numResults: 3,
    mode: "web",
    providerRuns: {
      exa: {
        status: "ok",
        latencyMs: 1200,
        results: [
          { url: "https://example.com/a", title: "A", snippet: "Snippet" },
        ],
      },
      ceramic: { status: "error", latencyMs: 300, results: [], error: "boom" },
    },
    judge: {
      model: "workers-ai:test",
      ranking: ["exa", "ceramic"],
      overall: [{ providerId: "exa", score: 80, verdict: "Good." }],
      dimensions: [
        {
          providerId: "exa",
          relevance: 80,
          freshness: 70,
          depth: 75,
          sourceQuality: 85,
          snippetUsefulness: 90,
        },
      ],
      strengths: [{ providerId: "exa", points: ["Fast"] }],
      weaknesses: [{ providerId: "exa", points: ["Thin"] }],
      notes: ["All missed X."],
    },
  };

  it("renders query, results, scores, and failures", () => {
    const md = runToMarkdown(run);
    expect(md).toContain("# SearchBench — test query");
    expect(md).toContain("[A](https://example.com/a)");
    expect(md).toContain("Ceramic (error");
    expect(md).toContain("| exa | 80 |");
    expect(md).toContain("Ranking: exa → ceramic");
    expect(md).toContain("All missed X.");
  });
});
