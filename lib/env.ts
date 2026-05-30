import { z } from "zod"

/**
 * Runtime-validated environment.
 *
 * Crashes the process at startup if anything required is missing or shaped
 * wrong. This is intentional — silent fallbacks for an integration platform
 * are how prod outages happen.
 *
 * Read once at import; never re-read at request time (tests rely on import
 * isolation, not env mutation).
 */
const SessionPasswordSchema = z
  .string()
  .min(32, "SESSION_PASSWORD must be at least 32 characters (used to derive cookie encryption key)")

const Schema = z.object({
  // Mirth target
  MIRTH_URL: z.string().url().refine(
    (v) => v.startsWith("https://") || v.startsWith("http://"),
    "MIRTH_URL must be http(s)://"
  ),
  MIRTH_USER: z.string().min(1),
  MIRTH_PASS: z.string().min(1),

  // TLS: provide ONE of MIRTH_CA_FILE or set MIRTH_INSECURE_SKIP_VERIFY=true
  // explicitly (dev only). Defaults to strict verification with the system CA bundle.
  MIRTH_CA_FILE: z.string().optional(),
  MIRTH_INSECURE_SKIP_VERIFY: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  // Session
  SESSION_PASSWORD: SessionPasswordSchema,
  SESSION_COOKIE_NAME: z.string().default("openmirth_session"),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(8 * 60 * 60),

  // Role mapping. Comma-separated usernames per tier. A user not listed in
  // any tier is denied login (closed-world default). Use "*" to grant a
  // tier to every authenticated user (sensible default for the viewer tier
  // in trusted environments).
  //
  // Example:
  //   OMCC_ROLE_ADMIN=alice,bob
  //   OMCC_ROLE_OPERATOR=charlie,dave
  //   OMCC_ROLE_VIEWER=*
  OMCC_ROLE_ADMIN: z.string().default(""),
  OMCC_ROLE_OPERATOR: z.string().default(""),
  OMCC_ROLE_VIEWER: z.string().default(""),

  // Optional embed targets
  GRAFANA_URL: z.string().url().optional(),
  CATALOG_URL: z.string().url().optional(),

  // Operational
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  PORT: z.coerce.number().int().positive().default(3030),
})

export type Env = z.infer<typeof Schema>

let cachedEnv: Env | null = null

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv

  const raw = {
    ...process.env,
    // Tests can pre-set SESSION_PASSWORD; in dev we generate a stable
    // throwaway so the app starts. NEVER do this in production — the schema
    // forces SESSION_PASSWORD to exist via the .env file.
    SESSION_PASSWORD:
      process.env.SESSION_PASSWORD ??
      (process.env.NODE_ENV !== "production"
        ? "dev-only-please-set-SESSION_PASSWORD-in-env-file"
        : undefined),
  }

  const result = Schema.safeParse(raw)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n")
    throw new Error(
      `OpenMirth Console environment validation failed:\n${issues}\n\n` +
        `Copy .env.example to .env.local and fill in required values.`
    )
  }

  if (result.data.NODE_ENV === "production" && result.data.MIRTH_INSECURE_SKIP_VERIFY) {
    throw new Error(
      "MIRTH_INSECURE_SKIP_VERIFY=true is forbidden in production. " +
        "Set MIRTH_CA_FILE to your Mirth CA path."
    )
  }

  cachedEnv = result.data
  return cachedEnv
}

/** For tests only — clears the cached env so the next getEnv() re-parses. */
export function _resetEnvForTests(): void {
  cachedEnv = null
}
