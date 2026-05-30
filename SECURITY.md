# Security Policy

## Supported versions

| Version | Supported     |
|---------|---------------|
| 0.1.x   | ✅ active     |

OpenMirth Console is pre-1.0 and ships rapid security updates. We will
backport critical fixes to the most recent minor release for 6 months
after a major version bump.

## Reporting a vulnerability

**Do not open a public GitHub issue for security findings.**

Email `security@nirmitee.io` with:

- A clear description of the issue
- Steps to reproduce (or a proof-of-concept)
- The affected version (commit SHA preferred)
- Any suggested mitigation

We will acknowledge within 2 business days and aim to ship a fix within 14
days for high-severity issues. We credit reporters in the release notes
unless you ask to remain anonymous.

## Scope

In scope:

- The OpenMirth Console application (Next.js app, libraries under `lib/`)
- The official Docker image and Helm chart
- Authentication, session management, CSRF protection, RBAC
- Mirth REST client behavior

Out of scope (report upstream):

- Vulnerabilities in Mirth Connect itself → NextGen Healthcare
- Vulnerabilities in Next.js, undici, iron-session, pino, etc. → respective projects
- Issues that require physical access or local code execution
- Social engineering of maintainers

## Threat model (what this product protects against)

| Threat | Mitigation |
|---|---|
| Cross-site request forgery on state-changing actions | Per-session CSRF token (32 bytes) verified on POST/PUT/DELETE |
| Session hijacking via cookie theft | iron-session encrypted cookies with `httpOnly`, `secure` (in prod), `sameSite=lax`, derived from `SESSION_PASSWORD` |
| Credential leakage via logs | pino redact paths cover `password`, `pass`, `headers.authorization`, `headers.cookie`, `MIRTH_PASS`, `SESSION_PASSWORD` |
| PHI in audit log | `audit()` event interface forbids PHI fields by convention; payload schema is reviewed in PRs |
| TLS MITM on Mirth REST channel | Per-request undici Agent with `MIRTH_CA_FILE` (preferred) or system trust store. `MIRTH_INSECURE_SKIP_VERIFY` is forbidden when `NODE_ENV=production`. |
| XSS via channel names/descriptions in UI | React escapes all rendered text by default. CSP headers via middleware. |
| Clickjacking of admin UI | `X-Frame-Options: DENY`, `frame-ancestors 'none'` CSP directive |
| Privilege escalation | Role enum is monotonic; every privileged action calls `authorize(permission, resource)` which emits an audit event |
| Replay of valid sessions after logout | `session.destroy()` invalidates the encrypted cookie; CSRF token is regenerated on every login |
| Container compromise → host escape | Helm chart runs as non-root (uid 1001), `readOnlyRootFilesystem`, drops `ALL` capabilities, seccomp `RuntimeDefault` |
| Network exfiltration from compromised pod | NetworkPolicy template restricts egress to Mirth namespace + DNS only |

## Out-of-scope (yet) — known design boundaries

These are intentionally not yet implemented; they are roadmap items.

1. **SSO / OIDC** — current login is a form submission that proxies credentials to Mirth. Phase 2 swaps in OIDC group-claim → role mapping. The form-based login is a deliberate Phase 1 limitation.
2. **Mutual TLS to Mirth** — only one-way TLS is supported in v0.1. Add when Phase 2 ships outbound mTLS via the undici Agent.
3. **Audit log persistence** — `audit()` currently emits to the structured logger. Persist to S3/object-lock for HIPAA tamper-evidence (recommended) — out of the box, downstream log retention is the audit trail.
4. **Rate limiting** — middleware does not enforce per-IP / per-user request quotas. Use ingress-level rate limiting (e.g., `nginx.ingress.kubernetes.io/limit-rps`) until app-level limits ship.

## Coordinated disclosure

We support a 90-day coordinated disclosure window. If a fix takes longer
than 90 days, we will publish a partial mitigation guide and continue
working on the full fix in coordination with the reporter.
