import type { SearchProvider } from "./base";
import { ceramicProvider } from "./ceramic";
import { exaProvider } from "./exa";
import { firecrawlProvider } from "./firecrawl";
import { serperProvider } from "./serper";

/**
 * Provider registry. To add a provider:
 *   1. Create `worker/providers/<id>.ts` exporting a `SearchProvider`
 *      (declare which `modes` it supports).
 *   2. Add one line below.
 *   3. Document the required `<ENV_KEY>` in README + `.dev.vars.example`.
 */
export const registry: Record<string, SearchProvider> = {
  [exaProvider.id]: exaProvider,
  [firecrawlProvider.id]: firecrawlProvider,
  [ceramicProvider.id]: ceramicProvider,
  [serperProvider.id]: serperProvider,
};

export function getProvider(id: string): SearchProvider | undefined {
  return registry[id];
}

export function listProviders(): SearchProvider[] {
  return Object.values(registry);
}
