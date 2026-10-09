import * as React from "react";
import { toast } from "sonner";
import type { Run } from "../../shared/schemas";
import { exportMdUrl, fetchRunMarkdown, useRejudge } from "../lib/api";
import { JudgePanel } from "./judge-panel";
import { ResultsCompare } from "./results-compare";
import { Button, Card } from "./ui";

export function RunView({
  run,
  onRetryOne,
  retrying,
  readOnly,
  live,
}: {
  run: Run;
  onRetryOne?: (providerId: string) => void;
  retrying?: boolean;
  readOnly?: boolean;
  /** Live stream not yet persisted — export/re-judge are unavailable. */
  live?: boolean;
}) {
  const [byRank, setByRank] = React.useState(true);
  const rejudge = useRejudge(run.id);

  const manualOrder = Object.keys(run.providerRuns);
  const order = React.useMemo(() => {
    if (!byRank || !run.judge) return manualOrder;
    const ranked = run.judge.ranking.filter((id) => manualOrder.includes(id));
    const rest = manualOrder.filter((id) => !ranked.includes(id));
    return [...ranked, ...rest];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byRank, run]);

  async function copyMarkdown() {
    try {
      const md = await fetchRunMarkdown(run.id);
      await navigator.clipboard.writeText(md);
      toast.success("Markdown copied to clipboard");
    } catch {
      toast.error("Could not copy the report");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">Results</h2>
        {run.judge && (
          <div className="inline-flex items-center gap-1 rounded-full border border-ink/10 p-1 text-xs">
            <button
              type="button"
              onClick={() => setByRank(false)}
              className={`rounded-full px-3 py-1 cursor-pointer ${!byRank ? "bg-ink text-white" : "text-muted-ink"}`}
            >
              Manual order
            </button>
            <button
              type="button"
              onClick={() => setByRank(true)}
              className={`rounded-full px-3 py-1 cursor-pointer ${byRank ? "bg-ink text-white" : "text-muted-ink"}`}
            >
              Judge rank
            </button>
          </div>
        )}
        <span className="ml-auto" />
        <Button variant="secondary" onClick={copyMarkdown} disabled={live} title={live ? "Available once the run is saved" : undefined}>
          Copy Markdown
        </Button>
        {live ? (
          <span
            className="inline-flex items-center justify-center gap-2 rounded-full bg-mist/60 border border-ink/10 px-5 py-2.5 text-sm font-medium text-ink opacity-50"
            title="Available once the run is saved"
          >
            Download .md
          </span>
        ) : (
          <a
            href={exportMdUrl(run.id)}
            download
            className="inline-flex items-center justify-center gap-2 rounded-full bg-mist/60 border border-ink/10 px-5 py-2.5 text-sm font-medium text-ink hover:bg-mist"
          >
            Download .md
          </a>
        )}
      </div>

      <ResultsCompare run={run} order={order} onRetryOne={readOnly ? undefined : onRetryOne} retrying={retrying} />

      {live && !run.judge && !run.judgeError ? (
        <Card>
          <div className="flex items-center gap-2 rounded-[24px] bg-white p-5 text-sm font-light text-muted-ink">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
            Judge is scoring… results above are already final.
          </div>
        </Card>
      ) : (
        <JudgePanel
          run={run}
          rejudging={rejudge.isPending}
          onRejudge={
            live
              ? undefined
              : () =>
                  rejudge.mutate(undefined, {
                    onSuccess: (d) => {
                      if (d.judge) toast.success("Re-judge complete");
                      else toast.warning(d.judgeError ?? "Judge returned nothing");
                    },
                    onError: (e) => toast.error(e.message),
                  })
          }
        />
      )}
    </div>
  );
}
