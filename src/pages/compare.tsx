import * as React from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Run, SearchMode } from "../../shared/schemas";
import { streamRun, useProviders, type StreamEvent } from "../lib/api";
import { ProviderPicker } from "../components/provider-picker";
import { ProviderSkeletonColumns, QueryBar } from "../components/query-bar";
import { RunView } from "../components/run-view";
import { Badge, Card, Stepper, Switch } from "../components/ui";

export function ComparePage() {
  const providersQuery = useProviders();
  const queryClient = useQueryClient();

  const [query, setQuery] = React.useState("");
  const [mode, setMode] = React.useState<SearchMode>("web");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [numResults, setNumResults] = React.useState(5);
  const [runJudge, setRunJudge] = React.useState(true);
  const [run, setRun] = React.useState<Run | null>(null);
  const [streaming, setStreaming] = React.useState(false);
  const [judging, setJudging] = React.useState(false);
  const [savedId, setSavedId] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const providers = providersQuery.data?.providers ?? [];
  const modeProviders = providers.filter((p) => p.modes.includes(mode));
  const configured = modeProviders.filter((p) => p.configured);

  // Preselect all configured providers for the current mode (once).
  React.useEffect(() => {
    setSelected((prev) =>
      prev.length === 0 ? configured.map((p) => p.id) : prev,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providersQuery.data, mode]);

  function switchMode(next: SearchMode) {
    if (next === mode) return;
    abortRef.current?.abort();
    setStreaming(false);
    setJudging(false);
    setMode(next);
    setRun(null);
    setSavedId(null);
    setSelected(
      providers
        .filter((p) => p.modes.includes(next) && p.configured)
        .map((p) => p.id),
    );
  }

  // Abort any live stream on unmount.
  React.useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const canRun =
    !streaming &&
    query.trim().length >= 3 &&
    selected.length > 0 &&
    selected.every(
      (id) => modeProviders.find((p) => p.id === id)?.configured,
    );

  function handleEvent(e: StreamEvent) {
    switch (e.type) {
      case "provider":
        setRun((prev) =>
          prev
            ? {
                ...prev,
                providerRuns: { ...prev.providerRuns, [e.providerId]: e.result },
              }
            : prev,
        );
        break;
      case "saved":
        setSavedId(e.runId);
        setRun((prev) => (prev ? { ...prev, id: e.runId } : prev));
        break;
      case "judge":
        setJudging(false);
        setRun((prev) =>
          prev
            ? {
                ...prev,
                ...(e.judge ? { judge: e.judge } : {}),
                ...(e.judgeError ? { judgeError: e.judgeError } : {}),
              }
            : prev,
        );
        if (e.judge) toast.success("Judge verdict ready");
        else if (e.judgeError) toast.warning("Judge skipped", { description: e.judgeError });
        break;
      case "done":
        setStreaming(false);
        setJudging(false);
        setSavedId(e.runId);
        setRun((prev) => (prev ? { ...prev, id: e.runId } : prev));
        void queryClient.invalidateQueries({ queryKey: ["history"] });
        break;
      case "error":
        setStreaming(false);
        setJudging(false);
        toast.error(e.error);
        break;
    }
  }

  function startStream(providerIds: string[], judge: boolean, mergeIntoCurrent: boolean) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (!mergeIntoCurrent) {
      setSavedId(null);
      setRun({
        id: "live",
        query: query.trim(),
        createdAt: new Date().toISOString(),
        numResults,
        mode,
        providerRuns: {},
      });
    }
    setStreaming(true);
    setJudging(judge);
    void streamRun(
      { query: query.trim(), providers: providerIds, numResults, runJudge: judge, mode },
      handleEvent,
      controller.signal,
    )
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setStreaming(false);
        setJudging(false);
        toast.error(err instanceof Error ? err.message : "Run failed");
      });
  }

  function startRun() {
    startStream(selected, runJudge, false);
  }

  function retryOne(providerId: string) {
    if (!run) return;
    startStream([providerId], false, true);
    toast.success(`Retrying ${providerId}…`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">
          Compare AI search providers
        </h1>
        <p className="mt-1 text-sm font-light text-muted-ink">
          One query, every provider, side by side — with an AI judge on top.
        </p>
        <div className="mt-4 inline-flex items-center gap-1 rounded-full border border-ink/10 bg-white p-1 text-sm">
          <button
            type="button"
            onClick={() => switchMode("web")}
            aria-pressed={mode === "web"}
            className={`rounded-full px-4 py-1.5 cursor-pointer ${mode === "web" ? "bg-ink text-white" : "text-muted-ink hover:text-ink"}`}
          >
            Regular search
          </button>
          <button
            type="button"
            onClick={() => switchMode("news")}
            aria-pressed={mode === "news"}
            className={`rounded-full px-4 py-1.5 cursor-pointer ${mode === "news" ? "bg-ink text-white" : "text-muted-ink hover:text-ink"}`}
          >
            News search
          </button>
        </div>
      </div>

      <QueryBar
        query={query}
        onQueryChange={setQuery}
        onRun={startRun}
        running={streaming}
        canRun={canRun}
        placeholder={
          mode === "news"
            ? "e.g. What is the latest news on GLP-1 weight loss drugs?"
            : undefined
        }
      />

      {providersQuery.isLoading ? (
        <p className="text-sm text-muted-ink">Loading providers…</p>
      ) : configured.length === 0 ? (
        <Card>
          <div className="rounded-[24px] bg-cream/60 p-5 text-sm">
            <p className="font-medium">
              {mode === "news"
                ? "No news providers configured yet."
                : "No search providers configured yet."}
            </p>
            <p className="mt-1 font-light text-muted-ink">
              {mode === "news" ? (
                <>
                  News search compares Exa, Serper, and Firecrawl. Add{" "}
                  <code className="font-mono text-xs">EXA_API_KEY</code>,{" "}
                  <code className="font-mono text-xs">SERPER_API_KEY</code> and{" "}
                  <code className="font-mono text-xs">FIRECRAWL_API_KEY</code> via{" "}
                  <code className="font-mono text-xs">wrangler secret put</code> or{" "}
                  <code className="font-mono text-xs">.dev.vars</code> — then compare away.
                </>
              ) : (
                <>
                  Add API keys (<code className="font-mono text-xs">EXA_API_KEY</code>,{" "}
                  <code className="font-mono text-xs">FIRECRAWL_API_KEY</code>,{" "}
                  <code className="font-mono text-xs">CERAMIC_API_KEY</code>,{" "}
                  <code className="font-mono text-xs">SERPER_API_KEY</code>) via{" "}
                  <code className="font-mono text-xs">wrangler secret put</code> or{" "}
                  <code className="font-mono text-xs">.dev.vars</code> — then compare away.
                </>
              )}
            </p>
            <Link
              to="/settings"
              className="mt-3 inline-flex rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white"
            >
              Open settings
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <ProviderPicker
            providers={modeProviders}
            selected={selected}
            onToggle={(id) =>
              setSelected((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
              )
            }
          />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
            <label className="flex items-center gap-2">
              <span className="font-light text-muted-ink">Results per provider</span>
              <Stepper value={numResults} min={3} max={10} onChange={setNumResults} />
            </label>
            <label className="flex items-center gap-2" title="Score, rank, and critique each result set with an LLM after providers finish">
              <Switch checked={runJudge} onCheckedChange={setRunJudge} label="AI judge" />
              <span className="font-light text-muted-ink">AI judge</span>
            </label>
            {selected.length < 2 && runJudge && (
              <Badge tone="cream">Pick 2+ providers for judging</Badge>
            )}
            {streaming && !judging && (
              <Badge tone="lav">Live — providers streaming in…</Badge>
            )}
            {judging && <Badge tone="accent">Judging…</Badge>}
          </div>
        </>
      )}

      {streaming && !run && (
        <ProviderSkeletonColumns count={Math.max(selected.length, 2)} />
      )}

      {run && Object.keys(run.providerRuns).length > 0 && (
        <RunView
          run={run}
          onRetryOne={retryOne}
          retrying={streaming}
          live={!savedId}
        />
      )}
    </div>
  );
}
