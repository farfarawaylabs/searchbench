import * as React from "react";
import type { NormalizedResult, ProviderResult, Run } from "../../shared/schemas";
import { cn } from "../lib/cn";
import { Badge, Button, Card, Separator } from "./ui";

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function ColumnHeader({
  name,
  result,
}: {
  name: string;
  result: ProviderResult;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-base font-semibold">{name}</span>
      <Badge tone={result.status === "ok" ? "neutral" : "bad"}>
        {result.status === "ok"
          ? `${result.results.length} results`
          : result.status}
      </Badge>
      <span className="ml-auto font-mono text-xs text-muted-ink">
        {(result.latencyMs / 1000).toFixed(1)}s
      </span>
    </div>
  );
}

function ResultItem({
  r,
  index,
  roomy,
}: {
  r: NormalizedResult;
  index: number;
  roomy?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <li
      className={cn(
        "rounded-2xl border border-ink/8 bg-white transition-shadow hover:card-shadow",
        roomy ? "p-5" : "p-3",
      )}
    >
      <div className="flex items-start gap-2">
        <span className="font-mono text-xs text-muted-ink">{index + 1}</span>
        <a
          href={r.url}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "min-w-0 flex-1 font-medium leading-snug hover:underline",
            roomy ? "text-base" : "text-sm",
          )}
        >
          {r.title || r.url}
          <span aria-hidden> ↗</span>
        </a>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge tone="cream">{domainOf(r.url)}</Badge>
        {r.publishedDate && (
          <span className="text-[11px] text-muted-ink">{r.publishedDate}</span>
        )}
      </div>
      <p
        className={cn(
          "mt-2 font-light leading-relaxed text-ink/80",
          roomy ? "text-[15px]" : "text-[13px]",
          !open && !roomy && "line-clamp-3",
        )}
      >
        {r.snippet || "No excerpt provided."}
      </p>
      {!roomy && r.snippet.length > 220 && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="mt-1 text-xs font-medium text-muted-ink hover:text-ink cursor-pointer"
        >
          {open ? "Show less" : "Full excerpt"}
        </button>
      )}
    </li>
  );
}

function ProviderModal({
  providerId,
  result,
  onClose,
}: {
  providerId: string;
  result: ProviderResult;
  onClose: () => void;
}) {
  const closeRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${providerId} results`}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 py-10 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Card className="w-full max-w-3xl">
        <div className="rounded-[24px] bg-white p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <ColumnHeader name={providerId} result={result} />
            </div>
            <Button buttonRef={closeRef} variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
          <Separator className="my-4" />
          {result.status !== "ok" ? (
            <p className="text-sm font-light text-muted-ink">
              {result.error ?? "No results returned."}
            </p>
          ) : (
            <ol className="space-y-4">
              {result.results.map((r, i) => (
                <ResultItem key={i} r={r} index={i} roomy />
              ))}
            </ol>
          )}
        </div>
      </Card>
    </div>
  );
}

export function ResultsCompare({
  run,
  order,
  onRetryOne,
  retrying,
}: {
  run: Run;
  order: string[];
  onRetryOne?: (providerId: string) => void;
  retrying?: boolean;
}) {
  const [modal, setModal] = React.useState<string | null>(null);
  const modalResult = modal ? run.providerRuns[modal] : undefined;
  return (
    <>
      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        {order.map((providerId, col) => {
          const pr = run.providerRuns[providerId];
          if (!pr) return null;
          return (
            <Card key={providerId}>
              <div className="rounded-[24px] bg-white p-5">
                <div className="flex items-center gap-2">
                  <Badge tone="lav">#{col + 1}</Badge>
                  <div className="min-w-0 flex-1">
                    <ColumnHeader name={providerId} result={pr} />
                  </div>
                </div>
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setModal(providerId)}
                    className="text-xs font-medium text-muted-ink hover:text-ink cursor-pointer"
                  >
                    Expand ⤢
                  </button>
                </div>
                <Separator className="my-3" />
                {pr.status !== "ok" ? (
                  <div className="rounded-2xl bg-mist/50 p-4 text-sm">
                    <p className="font-medium">
                      {pr.status === "timeout" ? "Timed out" : "Provider failed"}
                    </p>
                    <p className="mt-1 font-light text-muted-ink">
                      {pr.error ?? "No results returned."}
                    </p>
                    {onRetryOne && (
                      <Button
                        variant="secondary"
                        className="mt-3"
                        disabled={retrying}
                        onClick={() => onRetryOne(providerId)}
                      >
                        Retry {providerId}
                      </Button>
                    )}
                  </div>
                ) : (
                  <ol className="space-y-3">
                    {pr.results.map((r, i) => (
                      <ResultItem key={`${providerId}-${i}`} r={r} index={i} />
                    ))}
                  </ol>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      {modal && modalResult && (
        <ProviderModal
          providerId={modal}
          result={modalResult}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
