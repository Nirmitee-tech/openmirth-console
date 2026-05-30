# Operations Runbook

Quick reference for the on-call engineer paged about OpenMirth Console.

## Common alerts

### `openmirth_upstream_mirth_up == 0` (Mirth unreachable)

**Symptom:** Console dashboard shows "Could not reach Mirth" banner. `/api/readyz` returns 503.

**Triage:**

1. `kubectl -n openmirth-console exec deploy/openmirth-console -- curl -k <MIRTH_URL>/api/server/version`
   - If this works, the upstream is fine — restart the console pod (sticky session cookie may be poisoned)
2. `kubectl -n mirth get pods` — is Mirth itself crashlooping?
3. `kubectl -n openmirth-console get networkpolicy` — did someone change egress rules?
4. Check the console pod logs: `kubectl -n openmirth-console logs deploy/openmirth-console | tail -100`

**Common causes:**

- Mirth pod OOM-killed → check Mirth resource limits
- Mirth's TLS cert rotated and the new CA wasn't pushed to `MIRTH_CA_FILE` → update the ConfigMap, rolling restart
- NetworkPolicy regression after a chart upgrade

### Login failure spike

**Symptom:** `rate(openmirth_auth_events_total{outcome="denied"}[5m]) > 5`

**Triage:**

1. Check the source — is it one user typoing their password, or a credential-stuffing pattern from many IPs?
   ```
   kubectl logs deploy/openmirth-console | grep '"audit":true' | grep '"outcome":"denied"' | tail -50
   ```
2. If many IPs, enable ingress rate-limiting and consider IP-blocking at the WAF
3. If one user, check whether their Mirth account is locked

### Process restart loop

**Symptom:** `kube_pod_container_status_restarts_total` increases rapidly

**Triage:**

1. `kubectl -n openmirth-console describe pod -l app.kubernetes.io/name=openmirth-console` — look for OOMKilled
2. `kubectl logs --previous` — see what crashed the previous instance
3. Most likely causes:
   - Env validation failed at boot (missing SESSION_PASSWORD, bad MIRTH_URL)
   - OOM under load → bump `resources.limits.memory`
   - Mirth CA file invalid format

### Audit log absent

**Symptom:** No log lines with `"audit":true` for 30+ minutes during business hours

**Triage:**

1. Confirm pino is emitting at all: `kubectl logs deploy/openmirth-console | tail -10`
2. If pino is silent, check `LOG_LEVEL` — someone may have raised it past `info`
3. If pino emits but no audit entries: verify the audit sink (Loki, Datadog) parses JSON correctly

## Routine operations

### Rotate `SESSION_PASSWORD`

This invalidates all active sessions. Plan for it.

```bash
NEW=$(openssl rand -hex 32)
kubectl -n openmirth-console create secret generic openmirth-console-session \
  --from-literal=password=$NEW \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl -n openmirth-console rollout restart deploy/openmirth-console
```

### Upgrade the console

```bash
helm -n openmirth-console upgrade openmirth-console ./helm/openmirth-console \
  --set image.tag=<new-version> \
  --reuse-values
```

The Deployment uses `maxUnavailable: 0` — zero downtime.

### Roll back

```bash
helm -n openmirth-console rollback openmirth-console
```

### Drain a node hosting console pods

```bash
kubectl cordon <node>
kubectl drain <node> --ignore-daemonsets --delete-emptydir-data
```

The HPA + ReplicaSet will reschedule onto a remaining node.

## When the console is down but Mirth is fine

Users can always fall back to Mirth's Java Administrator client directly. The console adds zero dependencies to Mirth itself — it's read-only against the REST API (write paths in Phase 2 will be opt-in).

Document the Mirth Administrator launcher URL in your team wiki so on-call has a fallback.

## Where to find things

| What | Where |
|---|---|
| Source code | https://github.com/Nirmitee-tech/openmirth-console |
| Helm chart | `./helm/openmirth-console` |
| Bug reports | GitHub issues |
| Security disclosure | `security@nirmitee.io` |
| Commercial support | https://nirmitee.io/get-in-touch |
| Architecture overview | `docs/ARCHITECTURE.md` |
| Threat model | `SECURITY.md` |
