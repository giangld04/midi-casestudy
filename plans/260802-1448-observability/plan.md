# Observability (OpenTelemetry → Grafana Cloud)

Instrument the API **once** with the OpenTelemetry SDK and push **traces + metrics + logs**
via a single OTLP endpoint to Grafana Cloud (Tempo + Mimir/Prometheus + Loki), then
visualize + alert in Grafana. Matches the referenced blog's "instrument once, route via
OTLP" model. No self-hosted Collector/Prometheus on Railway (push-based, KISS).

**Backend:** Grafana Cloud (managed, free tier) · **Scope:** API + Socket.io (backend only)

## Signals
- **Traces:** auto-instrumentation of http, express, pg (Postgres), ioredis, socket.io →
  one distributed trace per request/event; DB + Redis spans show where latency lives.
- **Metrics (RED):** http server duration histogram + request counters from
  auto-instrumentation (rate, errors, p95/p99 duration). Domain gauge: active socket
  connections. Exported via OTLP → Grafana Cloud (queryable with PromQL).
- **Logs:** pino structured JSON; `trace_id`/`span_id` auto-injected → cross-signal
  correlation. Shipped via OTLP logs → Loki (and stdout for Railway).

## Key design
- `src/observability/telemetry.ts` loaded **before** express/pg (dev: top import; prod:
  `node --require` preload) so auto-instrumentation can patch the libs. Idempotent guard
  (globalThis flag) prevents double-start. **No-op** unless `OTEL_EXPORTER_OTLP_ENDPOINT`
  is set → local dev + tests unaffected.
- Exporters read standard `OTEL_*` env vars (endpoint, headers, protocol, service name),
  so config is 100% env-driven — no secrets in code.
- Graceful `SIGTERM`/`SIGINT` shutdown flushes buffered spans/metrics on Railway redeploys.

## Files
- create `apps/api/src/observability/telemetry.ts` — NodeSDK bootstrap
- create `apps/api/src/observability/logger.ts` — pino + trace correlation
- create `apps/api/src/observability/metrics.ts` — domain metrics (socket gauge)
- modify `apps/api/src/index.ts` — import telemetry first; console.log → logger
- modify `apps/api/src/socket/socket-server.ts` — wire active-connection gauge
- modify `apps/api/tsup.config.ts` — add telemetry entry
- modify `apps/api/Dockerfile` — CMD `--require ./dist/observability/telemetry.js`
- modify `apps/api/package.json` — OTel + pino deps, start/dev scripts
- append `apps/api/.env.example` — OTEL_* vars
- create `docs/observability.md` — Grafana Cloud setup + PromQL alert rules

## Env (set on Railway api service, from Grafana Cloud → OTLP/OpenTelemetry)
```
OTEL_EXPORTER_OTLP_ENDPOINT = https://otlp-gateway-<zone>.grafana.net/otlp
OTEL_EXPORTER_OTLP_HEADERS   = Authorization=Basic <base64(instanceID:token)>
OTEL_EXPORTER_OTLP_PROTOCOL  = http/protobuf
OTEL_SERVICE_NAME            = ama-midi-api
OTEL_RESOURCE_ATTRIBUTES     = deployment.environment=production,service.namespace=ama-midi
```

## Alerts (symptom-based, in Grafana Cloud)
- Error rate > 1% for 5m (page): `sum(rate(http_server_request_duration_seconds_count{http_response_status_code=~"5.."}[5m])) / sum(rate(http_server_request_duration_seconds_count[5m])) > 0.01`
- p99 latency > 1s for 5m (page): `histogram_quantile(0.99, sum(rate(http_server_request_duration_seconds_bucket[5m])) by (le)) > 1`
- API down (page): `up == 0` / no OTLP data received.

## Status
- [ ] deps + scripts
- [ ] telemetry.ts / logger.ts / metrics.ts
- [ ] wire index.ts + socket-server.ts
- [ ] tsup + Dockerfile preload
- [ ] docs + .env.example
- [ ] typecheck + build
- [ ] deploy + set Grafana Cloud env
