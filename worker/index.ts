import { Hono } from "hono";
import { nanoid } from "nanoid";
import {
  MAX_SNIPPET_CHARS,
  runRequestSchema,
  type JudgeOutput,
  type NormalizedResult,
  type ProviderResult,
  type Run,
  type SearchMode,
} from "../shared/schemas";
import { deleteRun, getRun, listRuns, saveRun, updateJudge } from "./db";
import { runToMarkdown } from "./export";
import { judgeConfig, runJudge } from "./judge";
import { apiKeyFor, runWithTimeout, truncate } from "./providers/base";
import { getProvider, listProviders } from "./providers";

const app = new Hono<{ Bindings: Env }>();

app.onError((err, c) => {
  console.error("API error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

function okResults(pr: ProviderResult): boolean {
  return pr.status === "ok" && pr.results.length > 0;
}

interface ValidRun {
  query: string;
  providers: string[];
  numResults: number;
  shouldJudge: boolean;
  mode: SearchMode;
}

/** Validate a run request; returns a JSON error response when invalid. */
function validateRunInput(
  c: { env: Env; json: (o: object, s?: number) => Response },
  body: unknown,
): ValidRun | Response {
  const parsed = runRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }
  const { query, providers, numResults, runJudge: shouldJudge, mode } = parsed.data;
  const unknown = providers.filter((id) => !getProvider(id));
  if (unknown.length > 0) {
    return c.json({ error: `Unknown providers: ${unknown.join(", ")}` }, 400);
  }
  const wrongMode = providers.filter((id) => {
    const p = getProvider(id);
    return p && !p.modes.includes(mode);
  });
  if (wrongMode.length > 0) {
    return c.json(
      {
        error: `Providers do not support "${mode}" search: ${wrongMode.join(", ")}`,
        unsupported: wrongMode.map((id) => {
          const p = getProvider(id);
          return { id, modes: p?.modes };
        }),
      },
      400,
    );
  }
  const missingKeys = providers.filter((id) => {
    const p = getProvider(id);
    return p && !apiKeyFor(c.env, p);
  });
  if (missingKeys.length > 0) {
    return c.json(
      {
        error: "Providers not configured",
        missing: missingKeys.map((id) => {
          const p = getProvider(id);
          return { id, envKey: p?.envKey };
        }),
      },
      400,
    );
  }
  return { query, providers, numResults, shouldJudge, mode };
}

async function runOneProvider(
  env: Env,
  query: string,
  id: string,
  numResults: number,
  mode: SearchMode,
): Promise<ProviderResult | null> {
  const provider = getProvider(id);
  if (!provider) return null;
  const apiKey = apiKeyFor(env, provider);
  if (!apiKey) return null;
  const result = await runWithTimeout(provider, query, { numResults, apiKey, mode });
  result.results = result.results.map((r: NormalizedResult) => ({
    ...r,
    snippet: truncate(r.snippet, MAX_SNIPPET_CHARS),
  }));
  return result;
}

/** Parallel fan-out; one provider failing never fails the run. */
async function fanOut(
  env: Env,
  query: string,
  providers: string[],
  numResults: number,
  mode: SearchMode,
): Promise<Record<string, ProviderResult>> {
  const settled = await Promise.all(
    providers.map(
      async (id) => [id, await runOneProvider(env, query, id, numResults, mode)] as const,
    ),
  );
  const providerRuns: Record<string, ProviderResult> = {};
  for (const [id, result] of settled) {
    if (result) providerRuns[id] = result;
  }
  return providerRuns;
}

function judgeInputs(providerRuns: Record<string, ProviderResult>) {
  return Object.entries(providerRuns)
    .filter(([, pr]) => okResults(pr))
    .map(([id, pr]) => ({
      providerId: id,
      providerName: getProvider(id)?.name ?? id,
      results: pr.results,
    }));
}

/** Run the judge with one retry; mutates run.judge / run.judgeError. */
async function maybeJudge(env: Env, run: Run, shouldJudge: boolean): Promise<void> {
  const succeeded = Object.entries(run.providerRuns).filter(([, pr]) => okResults(pr));
  if (!shouldJudge) return;
  if (succeeded.length >= 2) {
    const inputs = judgeInputs(run.providerRuns);
    try {
      run.judge = await runJudge(env, run.query, inputs, run.mode);
    } catch (firstErr) {
      // Retry once, then store a graceful error state.
      try {
        run.judge = await runJudge(env, run.query, inputs, run.mode);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("Judge failed after retry:", firstErr, err);
        run.judgeError = `The judge model failed to score this run (${message}). Results above are unaffected — try “Re-judge”.`;
      }
    }
  } else {
    run.judgeError =
      succeeded.length === 0
        ? "No provider returned results, so there was nothing to judge."
        : "Fewer than 2 providers returned results, so judging was skipped.";
  }
}

/** POST /api/run — fan out, judge, persist. */
app.post("/api/run", async (c) => {
  const body = await c.req.json().catch(() => null);
  const valid = validateRunInput(c, body);
  if (valid instanceof Response) return valid;
  const { query, providers, numResults, shouldJudge, mode } = valid;

  const run: Run = {
    id: nanoid(),
    query,
    createdAt: new Date().toISOString(),
    numResults,
    mode,
    providerRuns: await fanOut(c.env, query, providers, numResults, mode),
  };
  await maybeJudge(c.env, run, shouldJudge);
  await saveRun(c.env.DB, run);
  return c.json({ run });
});

function sse(event: string, data: object): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * POST /api/run/stream — same as /api/run but streams Server-Sent Events so
 * the UI can render each provider the moment it finishes:
 *   provider { providerId, result } → saved { runId } → judge { judge?, judgeError? } → done { runId }
 * Validation still happens up front (400 JSON before streaming starts).
 */
app.post("/api/run/stream", async (c) => {
  const body = await c.req.json().catch(() => null);
  const valid = validateRunInput(c, body);
  if (valid instanceof Response) return valid;
  const { query, providers, numResults, shouldJudge, mode } = valid;

  const run: Run = {
    id: nanoid(),
    query,
    createdAt: new Date().toISOString(),
    numResults,
    mode,
    providerRuns: {},
  };

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const write = (event: string, data: object) => writer.write(sse(event, data));

  // Stream provider results as each settles; never let one abort the stream.
  const settle = async (id: string) => {
    try {
      const result = await runOneProvider(c.env, query, id, numResults, mode);
      if (result) {
        run.providerRuns[id] = result;
        await write("provider", { providerId: id, result });
      }
    } catch (err) {
      console.error(`Provider ${id} crashed the stream guard:`, err);
    }
  };

  const respond = (async () => {
    try {
      await Promise.all(providers.map(settle));
      await saveRun(c.env.DB, run);
      await write("saved", { runId: run.id });
      if (shouldJudge) {
        await maybeJudge(c.env, run, true);
        await updateJudge(c.env.DB, run.id, run.judge ?? null, run.judgeError ?? null);
        await write("judge", { judge: run.judge ?? null, judgeError: run.judgeError ?? null });
      }
      await write("done", { runId: run.id });
    } catch (err) {
      console.error("Stream failed:", err);
      try {
        await write("error", { error: "Stream interrupted unexpectedly." });
      } catch {
        // client already gone
      }
    } finally {
      writer.close().catch(() => undefined);
    }
  })();
  c.executionCtx.waitUntil(respond);

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});

/** GET /api/providers — public metadata only, never secrets. */
app.get("/api/providers", (c) => {
  return c.json({
    providers: listProviders().map((p) => ({
      id: p.id,
      name: p.name,
      tagline: p.tagline,
      docsUrl: p.docsUrl,
      envKey: p.envKey,
      modes: p.modes,
      configured: !!apiKeyFor(c.env, p),
    })),
  });
});

/** GET /api/settings — judge backend info (no key values). */
app.get("/api/settings", (c) => {
  return c.json({ judge: judgeConfig(c.env) });
});

/** POST /api/runs/:id/judge — re-judge a stored run. */
app.post("/api/runs/:id/judge", async (c) => {
  const id = c.req.param("id");
  const run = await getRun(c.env.DB, id);
  if (!run) return c.json({ error: "Run not found" }, 404);
  const succeeded = Object.entries(run.providerRuns).filter(([, pr]) => okResults(pr));
  if (succeeded.length < 2) {
    return c.json({ error: "Need at least 2 successful providers to judge" }, 400);
  }
  const inputs = succeeded.map(([pid, pr]) => ({
    providerId: pid,
    providerName: getProvider(pid)?.name ?? pid,
    results: pr.results,
  }));
  let judge: JudgeOutput | null = null;
  let judgeError: string | null = null;
  try {
    judge = await runJudge(c.env, run.query, inputs, run.mode);
  } catch (firstErr) {
    try {
      judge = await runJudge(c.env, run.query, inputs, run.mode);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Re-judge failed:", firstErr, err);
      judgeError = `The judge model failed (${message}). Try again later.`;
    }
  }
  await updateJudge(c.env.DB, id, judge, judgeError);
  return c.json({ judge, judgeError });
});

app.get("/api/history", async (c) => {
  const limit = Number(c.req.query("limit") ?? "30");
  const runs = await listRuns(c.env.DB, Number.isFinite(limit) ? limit : 30);
  return c.json({ runs });
});

app.get("/api/runs/:id", async (c) => {
  const run = await getRun(c.env.DB, c.req.param("id"));
  if (!run) return c.json({ error: "Run not found" }, 404);
  return c.json({ run });
});

app.delete("/api/runs/:id", async (c) => {
  const deleted = await deleteRun(c.env.DB, c.req.param("id"));
  if (!deleted) return c.json({ error: "Run not found" }, 404);
  return c.json({ ok: true });
});

app.get("/api/runs/:id/export.md", async (c) => {
  const run = await getRun(c.env.DB, c.req.param("id"));
  if (!run) return c.json({ error: "Run not found" }, 404);
  return new Response(runToMarkdown(run), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="searchbench-${run.id}.md"`,
    },
  });
});

export default app;
