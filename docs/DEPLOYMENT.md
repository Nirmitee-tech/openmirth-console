# Deployment Guide

## Production checklist

Run through this before exposing the console outside your local laptop.

### Configuration

- [ ] `SESSION_PASSWORD` is at least 32 random chars from `openssl rand -hex 32`, stored in a secret manager (not committed)
- [ ] `MIRTH_URL` points at a Mirth instance reachable from the console pod
- [ ] `MIRTH_USER` is a dedicated **read-only or operator** account, **not the bootstrap `admin`**
- [ ] `MIRTH_CA_FILE` mounts your Mirth CA so TLS verification is on
- [ ] `MIRTH_INSECURE_SKIP_VERIFY` is unset (the Helm chart blocks setting it true in production)
- [ ] `NODE_ENV=production`
- [ ] `LOG_LEVEL=info` (use `debug` only for incident triage)
- [ ] `GRAFANA_URL` and `CATALOG_URL` are set if you want the embedded panels to work

### Network

- [ ] Ingress terminates TLS in front of the console; consider mTLS for admin endpoints
- [ ] NetworkPolicy restricts egress to Mirth namespace + DNS only (the Helm chart includes this)
- [ ] Prometheus is allowed to scrape `/api/metrics` (the chart includes a ServiceMonitor)
- [ ] Ingress rate-limiting is enabled (e.g., `nginx.ingress.kubernetes.io/limit-rps: "10"`)

### Identity

- [ ] (Recommended for v0.1) Front the console with an authenticating proxy (oauth2-proxy, Pomerium) until built-in OIDC ships in Phase 2
- [ ] Dedicated Mirth users per role; never share credentials
- [ ] Rotate `SESSION_PASSWORD` every 90 days (rolling restart picks up the new value; all sessions invalidate)

### Observability

- [ ] Logs forwarded to your aggregator (Loki, Datadog, Splunk) — pino emits JSON
- [ ] `/api/metrics` scraped by Prometheus; alerts on `openmirth_upstream_mirth_up == 0`
- [ ] Audit log lines (`audit.<permission>.<outcome>`) routed to a separate sink with object-lock retention for HIPAA tamper-evidence
- [ ] Liveness/readiness probes wired (Helm chart does this automatically)

### Resilience

- [ ] `replicaCount >= 2` (HPA default `minReplicas=2`)
- [ ] PodDisruptionBudget is configured if you use cluster autoscaling
- [ ] Pod anti-affinity spreads replicas across nodes / zones
- [ ] CPU/memory requests and limits are set appropriately for your traffic

## Deploy via Helm

```bash
# 1. Create secrets
kubectl create namespace openmirth-console
kubectl -n openmirth-console create secret generic openmirth-console-session \
  --from-literal=password=$(openssl rand -hex 32)
kubectl -n openmirth-console create secret generic openmirth-console-mirth \
  --from-literal=user=<read-only-mirth-user> \
  --from-literal=pass=<mirth-password>

# 2. (Optional but recommended) mount the Mirth CA
kubectl -n openmirth-console create configmap openmirth-console-mirth-ca \
  --from-file=mirth-ca.pem=/path/to/mirth-ca.pem

# 3. Install
helm install openmirth-console ./helm/openmirth-console \
  --namespace openmirth-console \
  --set image.tag=0.1.0 \
  --set mirth.url=https://mirth.mirth.svc.cluster.local:8443 \
  --set mirth.caConfigMap=openmirth-console-mirth-ca \
  --set ingress.hosts[0].host=console.example.com
```

## Deploy via Docker Compose

For dev / proof-of-concept only:

```bash
cp .env.example .env
# Edit .env: set SESSION_PASSWORD to a 32+ char random string
docker compose up -d
```

This stands up Mirth Connect + Postgres + the console in one shot. Open `http://localhost:3030`.

## Rolling upgrades

The Deployment uses `strategy.type: RollingUpdate` with `maxUnavailable: 0`, so zero-downtime deploys.

Sessions survive a deploy as long as `SESSION_PASSWORD` stays the same. If you rotate the password, all sessions invalidate (users see a redirect to `/login`).

## Backup & restore

The console is **stateless**. There is nothing to back up.

All state lives in Mirth Connect itself. Back up Mirth via its native mechanisms (Postgres dump, channel export through the REST API).

## Operational alerts to wire up

| Alert | Condition | Severity |
|---|---|---|
| Mirth unreachable | `openmirth_upstream_mirth_up == 0` for 2m | high |
| Login failure spike | `rate(openmirth_auth_events_total{outcome="denied"}[5m]) > 5` | medium |
| High request latency | `histogram_quantile(0.95, rate(openmirth_http_request_duration_seconds_bucket[5m])) > 2` | medium |
| Process restart loop | `kube_pod_container_status_restarts_total` derivative > 3/hr | high |
| Audit log absent | `rate({audit="true"}[10m]) == 0` for 30m (suspicious — likely a logger config break) | low |
