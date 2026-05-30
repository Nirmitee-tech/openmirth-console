# OpenMirth Console

> The open-source operations layer for Mirth Connect and OIE.
> Browser-native admin, clinical-impact observability, and a path off the Java Administrator.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-2554a4.svg)](LICENSE)
[![Built by Nirmitee.io](https://img.shields.io/badge/built_by-Nirmitee.io-0b2545)](https://nirmitee.io?utm_source=openmirth-console&utm_medium=readme-badge)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![Mirth Connect 4.5.2+](https://img.shields.io/badge/Mirth_Connect-4.5.2%2B-2554a4)](https://github.com/nextgenhealthcare/connect)

---

## Why this exists

Mirth Connect runs healthcare interoperability for thousands of hospitals. Its Java Administrator is 13 years old, universally hated, and — since NextGen made 4.6+ commercial in 2025 — there is no modern, vendor-neutral tooling for the open-source community on Mirth 4.5.2 or its OIE / BridgeLink forks.

OpenMirth Console fills that gap.

It is *not* a Mirth replacement. It is a **modern operations layer** that sits in front of an existing Mirth Connect (or OIE / BridgeLink), pulls every channel and runtime stat over the REST API, and renders a browser-native console that hospital ops teams can live in.

---

## What you get

- **🖥️ Browser admin.** Channel list, channel detail with source → transformer → destinations flow, runtime statistics. No Java client.
- **📊 Live dashboard.** Clinical-impact tiles (queued ADT, errored interfaces, total throughput) rendered server-side every page load.
- **🔌 Real Mirth REST integration.** Typed, Zod-validated. No mocks, no scraping the GUI.
- **🔐 Session auth + RBAC.** viewer / operator / admin roles with audit logging on every privileged action.
- **🩺 Built-in health probes.** `/api/healthz` and `/api/readyz` for Kubernetes; `/api/metrics` for Prometheus.
- **📦 Production-grade Helm chart.** HPA, NetworkPolicy, ServiceMonitor, PodSecurityContext defaults that pass restricted-tier pod-security admission.
- **🧪 Real tests.** Unit + integration (against live Mirth) + Playwright E2E. CI runs all three on every PR.
- **🔗 Integrates with the cookbook.** Embeds the [hospital-operations-dashboard](https://github.com/Nirmitee-tech/mirth-connect-cookbook/tree/main/docker/hospital-operations-dashboard) Grafana view and the [interface-catalog-generator](https://github.com/Nirmitee-tech/mirth-connect-cookbook/tree/main/scripts/operations/interface-catalog-generator) output as native tabs.

---

## Quick start

### One-command demo (Docker Compose)

```bash
git clone https://github.com/Nirmitee-tech/openmirth-console
cd openmirth-console
cp .env.example .env
# Edit .env: set SESSION_PASSWORD to a 32+ char random string
docker compose up -d
open http://localhost:3030
# Sign in with admin / admin (the demo Mirth defaults)
```

The compose file starts a fresh Mirth Connect 4.5.2 alongside the console. First boot takes ~30 seconds while Mirth provisions its database.

### Run against your existing Mirth

```bash
npm install
cp .env.example .env.local
# Edit .env.local — point MIRTH_URL at your Mirth
npm run dev
```

---

## Production deployment

For Kubernetes — use the bundled Helm chart:

```bash
helm install openmirth-console ./helm/openmirth-console \
  --namespace openmirth-console --create-namespace \
  --set mirth.url=https://mirth.internal:8443 \
  --set ingress.hosts[0].host=console.example.com
```

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the full production checklist (secrets, TLS, NetworkPolicy, alerts).

---

## Documentation

| Document | What it covers |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System diagram, layer responsibilities, data validation contracts, failure modes |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Production checklist, Helm install, alerts to wire up |
| [`docs/RUNBOOK.md`](docs/RUNBOOK.md) | On-call triage for common alerts |
| [`SECURITY.md`](SECURITY.md) | Threat model, supported versions, vulnerability disclosure |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Local dev, code style, PR checklist |

---

## How OpenMirth Console compares

| | OpenMirth Console | Mirth Java Administrator | Commercial alternatives |
|---|:---:|:---:|:---:|
| Browser-native | ✅ | ❌ Java client | ✅ |
| Open source (Apache 2.0) | ✅ | partial (3.x only) | ❌ |
| Per-seat fee | ❌ free | n/a | $$ |
| Clinical-impact observability | ✅ | ❌ | partial |
| RBAC with audit log | ✅ | partial | ✅ |
| Production K8s deploy | ✅ Helm chart | n/a | varies |
| Works with Mirth 4.5.2 + OIE + BridgeLink | ✅ | only matching Mirth version | mostly Mirth-only |
| Embeds Grafana + interface catalog | ✅ | ❌ | ❌ |

We compete one level above the Java client replacement game — see [the full positioning](docs/ARCHITECTURE.md#phase-2-roadmap-architectural).

---

## Roadmap

**v0.1 (now) — read path:**
- ✅ Channel list, channel detail, dashboard with live data
- ✅ Session auth + RBAC + audit log
- ✅ Health probes + Prometheus metrics
- ✅ Helm chart + CI

**v0.2 — write path:**
- Start/stop/pause channels with audit
- Message browser + one-click replay
- CSRF-protected server actions

**v0.3 — channel CI/CD:**
- Git-backed channel storage (auto-export on save)
- Channel diff between dev / staging / prod
- Promote workflows with approvals

**v1.0 — multi-engine:**
- OIE + BridgeLink adapters
- Cloverleaf → Mirth migration toolkit

**Beyond:**
- OIDC / SAML SSO
- Plugin marketplace
- Agentic AI co-pilot panels

See [GitHub Discussions](https://github.com/Nirmitee-tech/openmirth-console/discussions) for the full backlog.

---

## Built and maintained by Nirmitee.io

OpenMirth Console is developed by [**Nirmitee.io**](https://nirmitee.io?utm_source=openmirth-console&utm_medium=readme-maintainer), a healthcare IT consultancy specializing in:

- **Mirth Connect** deployment, custom channels, and upgrades
- **HL7v2, FHIR R4, ABDM, TEFCA** integration and conformance
- **Cloverleaf / Rhapsody → Mirth** migration engagements
- **Healthcare-AI** with the [RaptorX.ai](https://raptorx.ai) agentic platform

We also publish the [**Mirth Connect Cookbook**](https://github.com/Nirmitee-tech/mirth-connect-cookbook) — 50+ production-grade recipes for HL7v2 transformers, FHIR pipelines, observability stacks, and channel patterns. OpenMirth Console integrates with several of those recipes natively.

**Need commercial support, custom development, or a Cloverleaf migration?** [Talk to our team](https://nirmitee.io/get-in-touch?utm_source=openmirth-console&utm_medium=readme-support).

---

## License

Apache License 2.0 — see [LICENSE](LICENSE). Use it commercially, modify it, host it. Just keep the attribution.

Mirth Connect® is a registered trademark of NextGen Healthcare, Inc. OpenMirth Console is not affiliated with, endorsed by, or sponsored by NextGen Healthcare.
