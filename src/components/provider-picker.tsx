import type { ProviderMeta } from "../../shared/schemas";
import { cn } from "../lib/cn";
import { Badge, Card } from "./ui";

export function ProviderPicker({
  providers,
  selected,
  onToggle,
}: {
  providers: ProviderMeta[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {providers.map((p) => {
        const active = selected.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            disabled={!p.configured}
            onClick={() => onToggle(p.id)}
            title={
              p.configured
                ? p.tagline
                : `Add ${p.envKey} via wrangler secret to enable ${p.name}`
            }
            className={cn("text-left transition-transform cursor-pointer disabled:cursor-not-allowed", active && "-translate-y-0.5")}
          >
            <Card
              className={cn(
                "h-full transition-shadow",
                active ? "ring-2 ring-ink" : "opacity-90 hover:opacity-100",
                !p.configured && "opacity-60",
              )}
            >
              <div className="rounded-[24px] bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{p.name}</span>
                  {p.configured ? (
                    <Badge tone={active ? "accent" : "good"}>{active ? "on" : "off"}</Badge>
                  ) : (
                    <Badge tone="bad">missing key</Badge>
                  )}
                </div>
                <p className="mt-1 text-[13px] font-light text-muted-ink">{p.tagline}</p>
                {!p.configured && (
                  <p className="mt-2 font-mono text-[11px] text-muted-ink">
                    add {p.envKey} via wrangler secret
                  </p>
                )}
              </div>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
