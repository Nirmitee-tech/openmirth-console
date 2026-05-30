import { defineConfig } from "vitest/config"
import { resolve } from "node:path"

/**
 * Unit test config.
 *
 * Coverage strategy is *layered*:
 *
 *   - Unit tests (this config) cover pure-logic modules: env validation,
 *     RBAC role math, the Mirth XML parser, error class shape, request
 *     context, CSRF token generation. These have strict per-file
 *     thresholds enforced below.
 *
 *   - Integration tests (vitest.integration.config.ts) cover the live
 *     MirthClient against a real Mirth REST API. They are excluded from
 *     this run.
 *
 *   - E2E tests (Playwright) cover the UI — server components, route
 *     handlers, login/logout flow, channel browsing.
 *
 * CI runs all three layers. Pure-logic floors are enforced here; the
 * other layers fail their own runs if coverage drops.
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
    include: ["tests/unit/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      // Only measure the pure-logic modules unit tests are responsible for.
      // Modules that depend on the Next.js runtime (cookies(), headers())
      // or live Mirth are covered by integration + E2E tests, not here.
      include: [
        "lib/env.ts",
        "lib/request-context.ts",
        "lib/auth/roles.ts",
        "lib/auth/role-resolver.ts",
        "lib/mirth/errors.ts",
        "lib/mirth/parser.ts",
        "lib/mirth/schemas.ts",
      ],
      exclude: ["**/*.d.ts"],
      thresholds: {
        // Per-file floors — these are the modules unit tests own end-to-end.
        // If you add a new pure-logic module, add it here AND to `include`.
        perFile: true,
        // Conservative across-the-board floor — module-specific overrides
        // would go here if any module legitimately can't meet it.
        lines: 70,
        branches: 60,
        functions: 70,
        statements: 70,
      },
    },
  },
})
