import { useProviders, useSettings } from "../lib/api";
import { Badge, Card, Skeleton } from "../components/ui";

export function SettingsPage() {
  const providersQuery = useProviders();
  const settingsQuery = useSettings();
  const judge = settingsQuery.data?.judge;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight">Settings</h1>
        <p className="mt-1 text-sm font-light text-muted-ink">
          Keys live in Worker secrets — this page only shows whether each one is set.
        </p>
      </div>

      <Card>
        <div className="rounded-[24px] bg-white p-5">
          <h2 className="text-base font-semibold">Search providers</h2>
          {providersQuery.isLoading && <Skeleton className="mt-3 h-16" />}
          <ul className="mt-3 space-y-2">
            {(providersQuery.data?.providers ?? []).map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-2 rounded-2xl border border-ink/8 p-3 text-sm"
              >
                <span className="font-medium">{p.name}</span>
                <code className="rounded-full bg-mist/60 px-2.5 py-0.5 font-mono text-xs">
                  {p.envKey}
                </code>
                {p.modes.includes("news") && <Badge tone="lav">news</Badge>}
                <span className="ml-auto" />
                {p.configured ? (
                  <Badge tone="good">configured</Badge>
                ) : (
                  <Badge tone="bad">missing</Badge>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-2xl bg-mist/40 p-4 text-[13px] font-light text-ink/80">
            <p className="font-medium">Add a key locally</p>
            <code className="mt-1 block font-mono text-xs">
              echo "KEY=value" &gt;&gt; .dev.vars
            </code>
            <p className="mt-2 font-medium">Add a key in production</p>
            <code className="mt-1 block font-mono text-xs">npx wrangler secret put EXA_API_KEY</code>
            <p className="mt-2">
              Publishing publicly? Put the app behind{" "}
              <a
                href="https://developers.cloudflare.com/cloudflare-one/policies/access/"
                target="_blank"
                rel="noreferrer"
                className="font-medium underline"
              >
                Cloudflare Access
              </a>{" "}
              — there is no login in v1.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="rounded-[24px] bg-white p-5">
          <h2 className="text-base font-semibold">AI judge</h2>
          {settingsQuery.isLoading && <Skeleton className="mt-3 h-12" />}
          {judge && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <Badge tone="accent">{judge.backend}</Badge>
              <code className="rounded-full bg-mist/60 px-2.5 py-0.5 font-mono text-xs">
                {judge.model}
              </code>
              {judge.envKey ? (
                <span className="font-light text-muted-ink">
                  via BYOK secret <code className="font-mono text-xs">{judge.envKey}</code>
                </span>
              ) : (
                <span className="font-light text-muted-ink">
                  via Workers AI binding (no key needed)
                </span>
              )}
            </div>
          )}
          <p className="mt-3 text-[13px] font-light text-muted-ink">
            Override with secrets: set <code className="font-mono text-xs">JUDGE_MODEL</code> plus{" "}
            <code className="font-mono text-xs">JUDGE_OPENAI_API_KEY</code> or{" "}
            <code className="font-mono text-xs">JUDGE_ANTHROPIC_API_KEY</code>. See README.
          </p>
        </div>
      </Card>
    </div>
  );
}
