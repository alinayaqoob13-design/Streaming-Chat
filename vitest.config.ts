/**
 * ============================================================================
 * VITEST CONFIG
 * ============================================================================
 *
 * Test setup for the capstone (Week 6 Day 3+). React Testing Library for
 * components, node environment is NOT used — jsdom everywhere keeps one
 * mental model, and the pure helpers don't care.
 *
 * Coverage target: >=50% lines/functions/statements (capstone deliverable).
 * API routes and pure helpers carry most of the weight; heavy presentational
 * components are covered through their interactive logic.
 * ============================================================================
 */

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Mirror the tsconfig paths entry so `@/...` imports resolve in tests
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["lib/**", "components/**", "hooks/**", "app/api/**"],
      thresholds: {
        lines: 50,
        functions: 50,
        statements: 50,
      },
    },
  },
});
