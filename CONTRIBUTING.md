# Contributing to OpenMirth Console

Thanks for considering a contribution. OpenMirth Console is built and
maintained by [Nirmitee.io](https://nirmitee.io), but it is an open
project — community PRs are welcomed.

## Ground rules

1. **No mocks in shipped code.** Tests use real Mirth (the docker-compose stack works for everything). Production code never hard-codes example data.
2. **Strict types.** TypeScript strict mode is on. `any` is a code-review failure unless justified inline.
3. **Validate at the boundary.** Every payload that crosses a process boundary (env, REST, browser, session cookie) gets a Zod schema.
4. **Audit privileged actions.** Anything that mutates Mirth state must call `authorize(permission, resource)` — that function automatically emits an audit event.
5. **No PHI in logs or audit entries.** Use opaque IDs only.

## Setting up

```bash
git clone https://github.com/Nirmitee-tech/openmirth-console
cd openmirth-console
npm install
cp .env.example .env.local
# Edit .env.local with SESSION_PASSWORD (32+ chars) and Mirth coords
docker compose up -d mirth-db mirth     # if you don't already have a Mirth running
npm run dev
```

Open <http://localhost:3030>. Sign in with `admin` / `admin` (the demo Mirth defaults).

## The dev loop

```bash
npm run typecheck          # tsc --noEmit, no errors allowed
npm run lint               # next lint
npm test                   # vitest unit tests
npm run test:integration   # integration tests vs live Mirth
npm run test:e2e           # Playwright end-to-end
npm run build              # production build
```

CI runs all of these on every PR.

## Code style

- 2-space indent
- Tailwind utility classes, no CSS modules
- React server components by default; mark client components with `"use client"` only when needed (state, event handlers)
- Keep files focused — if a file grows past ~400 lines, split it
- No comments that just describe what the code does. Comments explain WHY: hidden constraint, surprising decision, link to issue, edge case rationale

## Commit messages

Conventional commits-ish but not strict:

```
Add channel reprocess button to detail page

Adds the reprocess action on /channels/[id] with CSRF + audit logging.
Operator role required.
```

## PR checklist

- [ ] `npm run check` passes locally
- [ ] New code has tests
- [ ] If a Mirth call is added, a typed error case is covered
- [ ] If a new env var is added, it's in `.env.example` + `lib/env.ts` Zod schema + `docs/DEPLOYMENT.md` checklist
- [ ] If a new privileged action is added, it's in `PERMISSIONS` + tested + documented in `SECURITY.md` threat table

## Reporting issues

Use GitHub issues for bugs and feature requests. For security findings see [SECURITY.md](SECURITY.md).
