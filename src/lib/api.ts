import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  HistoryItem,
  JudgeOutput,
  ProviderMeta,
  ProviderResult,
  Run,
  RunRequest,
} from "../../shared/schemas";

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) {
    throw new Error(
      data && typeof data.error === "string" ? data.error : `Request failed (${res.status})`,
    );
  }
  return data as T;
}

export function useProviders() {
  return useQuery({
    queryKey: ["providers"],
    queryFn: () => fetchJson<{ providers: ProviderMeta[] }>("/api/providers"),
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () =>
      fetchJson<{ judge: { backend: string; model: string; envKey: string | null } }>(
        "/api/settings",
      ),
  });
}

export function useRunMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RunRequest) =>
      fetchJson<{ run: Run }>("/api/run", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["history"] });
    },
  });
}

export function useHistory() {
  return useQuery({
    queryKey: ["history"],
    queryFn: () => fetchJson<{ runs: HistoryItem[] }>("/api/history?limit=50"),
  });
}

export function useRun(runId: string | undefined) {
  return useQuery({
    queryKey: ["run", runId],
    queryFn: () => fetchJson<{ run: Run }>(`/api/runs/${runId}`),
    enabled: !!runId,
  });
}

export function useDeleteRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ ok: boolean }>(`/api/runs/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["history"] });
    },
  });
}

export function useRejudge(runId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchJson<{ judge: Run["judge"]; judgeError: string | null }>(
        `/api/runs/${runId}/judge`,
        { method: "POST", body: "{}" },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["run", runId] });
      void qc.invalidateQueries({ queryKey: ["history"] });
    },
  });
}

export function exportMdUrl(runId: string): string {
  return `/api/runs/${runId}/export.md`;
}

export type StreamEvent =
  | { type: "provider"; providerId: string; result: ProviderResult }
  | { type: "saved"; runId: string }
  | { type: "judge"; judge: JudgeOutput | null; judgeError: string | null }
  | { type: "done"; runId: string }
  | { type: "error"; error: string };

interface ParsedSse {
  event: string;
  data: string;
}

/** Pure SSE frame parser (buffer in, complete events + remainder out). */
export function feedSse(buffer: string): { events: ParsedSse[]; rest: string } {
  const events: ParsedSse[] = [];
  const frames = buffer.split("\n\n");
  const rest = frames.pop() ?? "";
  for (const frame of frames) {
    let event = "message";
    const dataLines: string[] = [];
    for (const line of frame.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length > 0) events.push({ event, data: dataLines.join("\n") });
  }
  return { events, rest };
}

function toStreamEvent(e: ParsedSse): StreamEvent | null {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(e.data) as Record<string, unknown>;
  } catch {
    return null;
  }
  switch (e.event) {
    case "provider":
      return {
        type: "provider",
        providerId: data["providerId"] as string,
        result: data["result"] as ProviderResult,
      };
    case "saved":
      return { type: "saved", runId: data["runId"] as string };
    case "judge":
      return {
        type: "judge",
        judge: (data["judge"] ?? null) as JudgeOutput | null,
        judgeError: (data["judgeError"] ?? null) as string | null,
      };
    case "done":
      return { type: "done", runId: data["runId"] as string };
    case "error":
      return { type: "error", error: (data["error"] as string) ?? "Stream failed" };
    default:
      return null;
  }
}

/**
 * POST /api/run/stream and invoke onEvent per provider as results arrive.
 * Throws on validation errors (before streaming starts) or disconnects.
 */
export async function streamRun(
  body: RunRequest,
  onEvent: (e: StreamEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch("/api/run/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(
      data && typeof data.error === "string" ? data.error : `Request failed (${res.status})`,
    );
  }
  if (!res.body) throw new Error("Streaming is not supported in this browser.");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { events, rest } = feedSse(buffer);
    buffer = rest;
    for (const e of events) {
      const se = toStreamEvent(e);
      if (se) onEvent(se);
    }
  }
  const { events } = feedSse(buffer);
  for (const e of events) {
    const se = toStreamEvent(e);
    if (se) onEvent(se);
  }
}

export async function fetchRunMarkdown(runId: string): Promise<string> {
  const res = await fetch(exportMdUrl(runId));
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  return res.text();
}
