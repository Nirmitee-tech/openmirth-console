import pino from "pino"
import { getEnv } from "./env"

/**
 * Single shared logger. Pretty-prints in dev, JSON-lines in production
 * so log aggregators (Loki, Datadog, Splunk) ingest cleanly.
 *
 * Every log record carries an optional request_id for correlation across
 * service boundaries — see `withRequestId` in lib/request-context.ts.
 */
const env = getEnv()

export const logger = pino({
  level: env.LOG_LEVEL,
  base: {
    service: "openmirth-console",
    env: env.NODE_ENV,
  },
  // Redact common secret keys defensively. The structured log layer
  // should never carry passwords/tokens by accident.
  redact: {
    paths: [
      "password",
      "pass",
      "*.password",
      "*.pass",
      "headers.authorization",
      "headers.cookie",
      "*.headers.authorization",
      "*.headers.cookie",
      "MIRTH_PASS",
      "SESSION_PASSWORD",
    ],
    censor: "[REDACTED]",
  },
  transport:
    env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:HH:MM:ss.l",
            ignore: "pid,hostname,service,env",
          },
        }
      : undefined,
})

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings)
}
