import * as React from "react";
import type { Run } from "../../shared/schemas";
import { Badge, Button, Card, Progress, Separator } from "./ui";

const MEDALS = ["🥇", "🥈", "🥉"];

const DIMENSIONS: { key: "relevance" | "freshness" | "depth" | "sourceQuality" | "snippetUsefulness"; label: string }[] = [
  { key: "relevance", label: "Relevance" },
  { key: "freshness", label: "Freshness" },
  { key: "depth", label: "Depth" },
  { key: "sourceQuality", label: "Source quality" },
  { key: "snippetUsefulness", label: "Snippet usefulness" },
];

export function JudgePanel({
  run,
  onRejudge,
  rejudging,
}: {
  run: Run;
  onRejudge?: () => void;
  rejudging?: boolean;
}) {
  const [open, setOpen] = React.useState<string | null>(null);

  if (!run.judge) {
    return (
      <Card>
        <div className="rounded-[24px] bg-cream/60 p-5 text-sm">
          <p className="font-medium">No judge verdict for this run.</p>
          <p className="mt-1 font-light text-muted-ink">
            {run.judgeError ?? "The judge did not run."}
          </p>
          {onRejudge && (
            <Button variant="secondary" className="mt-3" disabled={rejudging} onClick={onRejudge}>
              {rejudging ? "Re-judging…" : "Re-judge"}
            </Button>
          )}
        </div>
      </Card>
    );
  }

  const judge = run.judge;
  const sorted = judge.overall.slice().sort((a, b) => b.score - a.score);

  return (
    <Card>
      <div className="rounded-[24px] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">AI judge</h2>
          <Badge tone="neutral">{judge.model}</Badge>
          <span className="ml-auto" />
          {onRejudge && (
            <Button variant="secondary" disabled={rejudging} onClick={onRejudge}>
              {rejudging ? "Re-judging…" : "Re-judge"}
            </Button>
          )}
        </div>

        <ol className="mt-4 space-y-3">
          {sorted.map((o, i) => {
            const dims = judge.dimensions.find((d) => d.providerId === o.providerId);
            const strengths = judge.strengths.find((s) => s.providerId === o.providerId);
            const weaknesses = judge.weaknesses.find((w) => w.providerId === o.providerId);
            const isOpen = open === o.providerId;
            return (
              <li key={o.providerId} className="rounded-2xl border border-ink/8 p-4">
                <div className="flex items-center gap-3">
                  <span className="text-xl" aria-hidden>{MEDALS[i] ?? `${i + 1}.`}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold">{o.providerId}</span>
                      <span className="font-mono text-sm font-bold tabular-nums">{o.score}</span>
                    </div>
                    <Progress value={o.score} className="mt-2" />
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => setOpen(isOpen ? null : o.providerId)}
                    aria-expanded={isOpen}
                  >
                    {isOpen ? "Hide" : "Details"}
                  </Button>
                </div>
                <p className="mt-2 text-sm font-light text-ink/80">{o.verdict}</p>
                {isOpen && (
                  <div className="mt-3">
                    <Separator className="mb-3" />
                    {dims && (
                      <dl className="grid gap-2 sm:grid-cols-2">
                        {DIMENSIONS.map((dim) => (
                          <div key={dim.key} className="flex items-center gap-2 text-sm">
                            <dt className="w-36 shrink-0 font-light text-muted-ink">{dim.label}</dt>
                            <dd className="flex flex-1 items-center gap-2">
                              <Progress value={dims[dim.key]} className="flex-1" />
                              <span className="w-8 text-right font-mono text-xs tabular-nums">
                                {dims[dim.key]}
                              </span>
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {strengths && strengths.points.length > 0 && (
                      <div className="mt-3 text-sm">
                        <p className="font-medium text-emerald-900">Strengths</p>
                        <ul className="mt-1 list-disc space-y-1 pl-5 font-light">
                          {strengths.points.map((p, k) => <li key={k}>{p}</li>)}
                        </ul>
                      </div>
                    )}
                    {weaknesses && weaknesses.points.length > 0 && (
                      <div className="mt-3 text-sm">
                        <p className="font-medium text-red-900">Weaknesses</p>
                        <ul className="mt-1 list-disc space-y-1 pl-5 font-light">
                          {weaknesses.points.map((p, k) => <li key={k}>{p}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        {judge.notes.length > 0 && (
          <div className="mt-4 rounded-2xl bg-lav/50 p-4 text-sm">
            <p className="font-medium">Cross-provider notes</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 font-light">
              {judge.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
