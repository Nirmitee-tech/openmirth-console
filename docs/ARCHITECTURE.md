# OpenMirth Console — Architecture

## At a glance

```
┌──────────────────────┐                                      ┌──────────────────┐
│  Browser             │  HTTPS, session cookie              │   Operator       │
│  (Operator / CIO /   │ ◀───────────────────────────────────│   (human)        │
│   Compliance team)   │                                      └──────────────────┘
└─────────┬────────────┘
          │ HTTPS
          ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  OpenMirth Console (Next.js 15 app, Node.js 20)                              │
│                                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  ┌────────────────┐ │
│  │ middleware  │  │ React Server │  │  Route Handlers │  │ Prometheus     │ │
│  │ (X-Request- │  │ Components   │  │   /api/auth/*   │  │  /api/metrics  │ │
│  │  ID, CSP,   │  │ /            │  │   /api/healthz  │  │                │ │
│  │  cookie auth│  │ /channels    │  │   /api/readyz   │  │                │ │
│  │  gate)      │  │ /channels/id │  │                 │  │                │ │
│  └─────────────┘  └──────┬───────┘  └─────────────────┘  └────────────────┘ │
│                          │                                                   │
│                          ▼                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  lib/mirth/client.ts — typed, Zod-validated Mirth REST client        │   │
│  │  per-request undici Agent with optional MIRTH_CA_FILE                │   │
│  │  cookie-based session reuse, transparent re-login on 401             │   │
│  └─────────────────────────────────┬────────────────────────────────────┘   │
└────────────────────────────────────│─────────────────────────────────────────┘
                                     │ HTTPS (TLS verified)
                                     ▼
                          ┌────────────────────────┐
                          │  Mirth Connect 4.5.2+  │
                          │  REST API :8443        │
                          └────────────────────────┘
```

## Layer responsibilities

| Layer | Files | Responsibility |
|---|---|---|
| **Edge / middleware** | `middleware.ts` | X-Request-ID propagation, security headers (HSTS, CSP, X-Frame-Options), cheap cookie-based auth gate that short-circuits unauthenticated app-route requests to `/login` |
| **UI** | `app/**/*.tsx`, `components/**/*.tsx` | Server-rendered pages that call the Mirth client directly. No client-side data fetching for the read path — eliminates an entire class of cache-invalidation bugs |
| **API routes** | `app/api/**/*.ts` | Login/logout/me, health probes, Prometheus metrics endpoint |
| **Auth** | `lib/auth/*.ts` | iron-session encrypted cookies, RBAC role enforcement, CSRF token generation + constant-time verification, structured audit log |
| **Mirth client** | `lib/mirth/*.ts` | REST API wrapper, XML → typed object parsing, schema validation, error taxonomy |
| **Observability** | `lib/logger.ts`, `lib/metrics.ts`, `lib/request-context.ts` | pino structured logs (redact-by-default), Prometheus metric registry, AsyncLocalStorage request context |
| **Config** | `lib/env.ts` | Zod-validated environment at startup; the process fails to boot if config is wrong |

## Why server components for the read path

The dashboard, channels list, and channel detail pages render server-side and pull data directly via the Mirth client. There is no `/api/channels` route, no React-Query, no client-side fetching. The benefits:

1. **Single source of truth.** The Mirth REST API IS the database. Caching it on the app side risks staleness for a real-time operations console.
2. **Smaller bundle.** No data-fetching library in the browser; first-load JS is ~106 KB.
3. **Mirth credentials never leave the server.** The browser only sees rendered HTML and the encrypted session cookie.
4. **Simpler error story.** A Mirth outage shows up as a server-rendered "Mirth unreachable" banner, not a client-side loading spinner that spins forever.

The write path (start/stop channels, replay messages — coming in Phase 2) WILL use server actions or POST routes, because mutations need explicit user confirmation and CSRF protection.

## Concurrency model

- **One MirthClient singleton per process.** Mirth's REST session is cheap to maintain via the `JSESSIONID` cookie; one shared client avoids the login storm a per-request client would cause.
- **Re-login on 401 is transparent.** If Mirth's session expires (default 30 min idle), the client re-logs in and retries once. After that it throws `MirthAuthError`.
- **Per-request `AsyncLocalStorage` for request IDs.** Lets the logger correlate every line with the originating browser request without threading the ID through every function signature.

## Data validation contracts

Every payload that crosses an interface boundary is Zod-validated:

| Boundary | Schema | What we catch |
|---|---|---|
| `process.env` → app | `Schema` in `lib/env.ts` | Missing config, short SESSION_PASSWORD, bad MIRTH_URL |
| Mirth XML → app | `DashboardStatusSchema`, `ChannelSchema` in `lib/mirth/schemas.ts` | Mirth version upgrades that change field shapes, missing required fields, bad enum values |
| Browser → API routes | `LoginRequestSchema` etc. | Malformed JSON, missing fields, invalid role values |
| Session cookie → request | `SessionDataSchema` in `lib/auth/session.ts` | Tampered or stale cookies (iron-session also fails the decryption) |

When validation fails we throw a typed error (e.g., `MirthSchemaError`) and the relevant page renders an error banner. We never silently fall back to default values for missing required fields.

## Failure modes and how we handle them

| Scenario | UX | Server log | Metric |
|---|---|---|---|
| Mirth unreachable (network) | Dashboard shows "Could not reach Mirth" banner; channel list empty | `error` log with cause | `openmirth_upstream_mirth_up=0` |
| Mirth auth rejected | Login form shows "Invalid credentials" | `info` log | `openmirth_auth_events_total{outcome="denied"}` |
| Session cookie tampered | iron-session decryption fails → 401 → redirect to `/login` | `warn` | n/a |
| Mirth schema mismatch | Page shows error message naming the failed field | `error` with Zod issues array | n/a |
| Env validation fails at boot | Process crashes with explicit field-by-field error | `fatal` | Pod restarts; readiness fails |

## Phase 2 roadmap (architectural)

Items deliberately out of scope for v0.1:

1. **OIDC / SAML SSO** — replace the form-based login with IdP-driven auth. Map IdP group claims to OpenMirth roles.
2. **Write path: start/stop/deploy/replay** — server actions with explicit CSRF + audit.
3. **Channel editor** — visual transformer builder, channel diff between dev/staging/prod.
4. **Git-backed channel storage** — auto-export on save, PR-based promotion.
5. **Multi-engine adapter** — pluggable backends for OIE, BridgeLink, and (eventually) Rhapsody migration tooling.
6. **Plugin marketplace** — community channel templates, dashboard widgets, transformers.
7. **Agentic AI co-pilot** — per-channel AI panels, anomaly explanations, debug suggestions (RaptorX integration).
