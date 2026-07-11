import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    hookTimeout: 60_000,
    testTimeout: 20_000
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      "server-only": path.resolve(__dirname, "tests/supabase/server-only-stub.ts")
    }
  }
});
