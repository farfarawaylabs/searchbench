import * as React from "react";
import { Badge, Button, Card, Skeleton, Textarea } from "./ui";

export function QueryBar({
  query,
  onQueryChange,
  onRun,
  running,
  canRun,
  placeholder,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  onRun: () => void;
  running: boolean;
  canRun: boolean;
  placeholder?: string;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <Card className="gradient-edge">
      <div className="rounded-[24px] bg-white p-4 sm:p-5">
        <Textarea
          inputRef={ref}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          rows={3}
          placeholder={placeholder ?? "e.g. What are the latest developments with GLP-1 weight loss drugs?"}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onRun();
            }
          }}
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <Badge tone="neutral" className="hidden sm:inline-flex">
            ⌘K to focus · Enter to run
          </Badge>
          <Button onClick={onRun} disabled={running || !canRun}>
            {running ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Running…
              </>
            ) : (
              "Run comparison"
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function ProviderSkeletonColumns({ count }: { count: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <div className="rounded-[24px] bg-white p-5">
            <div className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
              <Skeleton className="h-5 w-32" />
            </div>
            <Skeleton className="mt-4 h-24 w-full" />
            <Skeleton className="mt-2 h-24 w-full" />
            <Skeleton className="mt-2 h-24 w-5/6" />
          </div>
        </Card>
      ))}
    </div>
  );
}
