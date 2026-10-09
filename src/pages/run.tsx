import { Link, useParams } from "@tanstack/react-router";
import { useRun } from "../lib/api";
import { RunView } from "../components/run-view";
import { Card, Skeleton } from "../components/ui";

export function RunPage() {
  const { runId } = useParams({ from: "/history/$runId" });
  const query = useRun(runId);

  return (
    <div className="space-y-6">
      <Link to="/history" className="text-sm font-medium text-muted-ink hover:text-ink">
        ← Back to history
      </Link>
      {query.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-64" />
        </div>
      )}
      {query.isError && (
        <Card>
          <p className="rounded-[24px] bg-white p-5 text-sm text-red-900">
            Could not load this run. It may have been deleted.
          </p>
        </Card>
      )}
      {query.data && (
        <>
          <div>
            <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
              {query.data.run.query}
            </h1>
            <p className="mt-1 font-mono text-xs text-muted-ink">
              {new Date(query.data.run.createdAt).toLocaleString()} ·{" "}
              {query.data.run.mode === "news" ? "news search" : "web search"} ·{" "}
              {query.data.run.id}
            </p>
          </div>
          <RunView run={query.data.run} readOnly />
        </>
      )}
    </div>
  );
}
