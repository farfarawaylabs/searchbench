import { defineConfig } from "vitest/config";

// Standalone test config: the Cloudflare Vite plugin rejects vitest's
// node-external environment, and these tests (worker/shared pure logic)
// don't need it.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
