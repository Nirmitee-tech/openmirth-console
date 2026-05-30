import { defineConfig } from "vitest/config"
import { resolve } from "node:path"

/**
 * Integration tests — hit a live Mirth Connect at MIRTH_URL.
 *
 * Run with:
 *   MIRTH_URL=https://localhost:8443 MIRTH_USER=admin MIRTH_PASS=admin \
 *     MIRTH_INSECURE_SKIP_VERIFY=true SESSION_PASSWORD=...32chars... \
 *     npm run test:integration
 *
 * CI runs this in a job that spins up the same Mirth docker-compose
 * stack used by the cookbook recipes.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
  test: {
    globals: false,
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
