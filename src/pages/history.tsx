import * as React from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useDeleteRun, useHistory } from "../lib/api";
import { Badge, Card, Skeleton } from "../components/ui";

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function HistoryPage() {
  const history = useHistory();
  const del = useDeleteRun();
  const [filter, setFilter] = React.useState("");

  const runs = (history.data?.runs ?? []).filter((r) =>
    r.query.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">History</h1>
          <p className="mt-1 text-sm font-light text-muted-ink">
            Past comparisons — replay any run or re-judge it.
          </p>
        </div>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by query…"
          className="ml-auto w-full max-w-xs rounded-full border border-ink/10 bg-white px-4 py-2 text-sm outline-none focus:border-ink/30 focus:ring-4 focus:ring-lav/60"
        />
      </div>

      {history.isLoading && (
        <div className="grid gap-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      )}
      {history.isError && (
        <Card>
          <p className="rounded-[24px] bg-white p-5 text-sm text-red-900">
            Could not load history.
          </p>
        </Card>
      )}
      {history.data && runs.length === 0 && (
        <Card>
          <p className="rounded-[24px] bg-white p-5 text-sm font-light text-muted-ink">
            {filter ? "No runs match that filter." : "No runs yet — go run your first comparison."}
          </p>
        </Card>
      )}

      <div className="grid gap-3">
        {runs.map((r) => (
          <Card key={r.id}>
            <div className="flex flex-wrap items-center gap-2 rounded-[24px] bg-white p-4">
              <Link
                to="/history/$runId"
                params={{ runId: r.id }}
                className="min-w-0 flex-1 hover:underline"
              >
                <span className="block truncate text-sm font-medium">{r.query}</span>
                <span className="mt-0.5 block text-xs font-light text-muted-ink">
                  {timeAgo(r.createdAt)} · {r.mode === "news" ? "news" : "web"} ·{" "}
                  {r.providerIds.join(", ")}
                </span>
              </Link>
              {r.winnerId ? (
                <Badge tone="accent">
                  Winner: {r.winnerId} · {r.winnerScore}
                </Badge>
              ) : (
                <Badge tone="neutral">no verdict</Badge>
              )}
              <button
                type="button"
                disabled={del.isPending}
                onClick={() =>
                  del.mutate(r.id, {
                    onSuccess: () => toast.success("Run deleted"),
                    onError: (e) => toast.error(e.message),
                  })
                }
                className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-ink hover:bg-red-50 hover:text-red-900 cursor-pointer"
              >
                Delete
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
