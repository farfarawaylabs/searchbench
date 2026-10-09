import type {
  NormalizedResult,
  ProviderResult,
  SearchMode,
} from "../../shared/schemas";
import { PROVIDER_TIMEOUT_MS } from "../../shared/schemas";

/** Every search adapter implements this. Adding a provider = one new file
 *  implementing this interface + one line in `registry` below. */
export interface SearchProvider {
  id: string;
  name: string;
  tagline: string;
  docsUrl: string;
  /** Worker secret holding this provider's API key, e.g. "EXA_API_KEY". */
  envKey: string;
  /** Search modes this adapter implements. */
  modes: SearchMode[];
  search(
    query: string,
    opts: { numResults: number; apiKey: string; mode: SearchMode },
  ): Promise<ProviderResult>;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

export function clean(text: unknown, max: number): string {
  if (typeof text !== "string") return "";
  return truncate(text.replace(/\s+/g, " ").trim(), max);
}

/** Narrow an unknown JSON value to an array (provider payloads change shape). */
export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** Runs a provider with a hard timeout; never throws. */
export async function runWithTimeout(
  provider: SearchProvider,
  query: string,
  opts: { numResults: number; apiKey: string; mode: SearchMode },
): Promise<ProviderResult> {
  const started = Date.now();
  const latency = () => Date.now() - started;
  try {
    const result = await Promise.race([
      provider.search(query, opts),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`timed out after ${PROVIDER_TIMEOUT_MS}ms`)),
          PROVIDER_TIMEOUT_MS,
        ),
      ),
    ]);
    return { ...result, latencyMs: latency() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const timedOut =
      message.includes("timed out") || (err instanceof Error && err.name === "AbortError");
    return {
      status: timedOut ? "timeout" : "error",
      latencyMs: latency(),
      results: [] as NormalizedResult[],
      error: timedOut
        ? `${provider.name} timed out after ${PROVIDER_TIMEOUT_MS / 1000}s`
        : `${provider.name} failed: ${message}`,
    };
  }
}

export function apiKeyFor(env: Env, provider: SearchProvider): string | undefined {
  const value = (env as unknown as Record<string, string | undefined>)[provider.envKey];
  return value && value.length > 0 ? value : undefined;
}
