# Observability (OpenTelemetry → Grafana Cloud)

The API is instrumented **once** with the OpenTelemetry SDK and pushes all three
signals — **traces, metrics, logs** — over a single **OTLP** endpoint. Point that
endpoint at any OTLP backend; we use **Grafana Cloud** (Tempo + Mimir/Prometheus +
Loki + Grafana + Alerting), free tier. No Collector or Prometheus server to self-host.

> Instrument once, route via OTLP → swap backends without touching app code.

## What's instrumented (scope: API + Socket.io)

Auto-instrumentation (`@opentelemetry/auto-instrumentations-node`) patches:

| Signal | Source | Gives you |
|--------|--------|-----------|
| Traces | http, express, **pg**, **ioredis**, **socket.io** | One distributed trace per request/WS event; DB + Redis spans pinpoint latency |
| Metrics (RED) | http/express server | `http.server.request.duration` histogram → rate, error %, p95/p99 |
| Metrics (domain) | `observability/metrics.ts` | `app_socket_connections_active` gauge (realtime saturation) |
| Logs | pino + pino instrumentation | Structured JSON with `trace_id`/`span_id` auto-injected → log↔trace jump |

## How it loads (important)

OpenTelemetry must patch `http`/`pg`/etc. **before** they are required:

- **Prod:** `Dockerfile` runs `node --require ./dist/observability/telemetry.js dist/index.js`.
- **Dev:** `index.ts` imports `./observability/telemetry` as its first statement.
- Idempotent (a `globalThis` flag) so the two paths never double-start.
- **No-op** unless `OTEL_EXPORTER_OTLP_ENDPOINT` is set → local dev + tests run clean.
- `SIGTERM`/`SIGINT` flush buffered signals on Railway redeploys.

## Setup — Grafana Cloud (free)

1. Create a free stack at <https://grafana.com/>.
2. **Home → Connections → Add new connection → OpenTelemetry (OTLP)**. Grafana shows:
   - **OTLP endpoint**: `https://otlp-gateway-<zone>.grafana.net/otlp`
   - **Instance ID** + an **API token** (generate one). Base64-encode `instanceID:token`.
3. Set these env vars on the Railway **api** service (or `.env` locally):

```bash
OTEL_EXPORTER_OTLP_ENDPOINT="https://otlp-gateway-<zone>.grafana.net/otlp"
OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic <base64(instanceID:token)>"
OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf"
OTEL_SERVICE_NAME="ama-midi-api"
OTEL_RESOURCE_ATTRIBUTES="deployment.environment=production,service.namespace=ama-midi"
```

Railway CLI:
```bash
railway variables --service api \
  --set 'OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-<zone>.grafana.net/otlp' \
  --set 'OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic <base64>' \
  --set 'OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf' \
  --set 'OTEL_SERVICE_NAME=ama-midi-api' \
  --set 'OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production,service.namespace=ama-midi'
```

4. Redeploy. Within ~30s: traces appear in **Explore → Tempo**, metrics in **Mimir**
   (PromQL), logs in **Loki**.

## Dashboards — four golden signals (RED)

**Import the ready-made one:** Grafana → **Dashboards → New → Import → Upload JSON file** →
`docs/grafana/ama-midi-red-dashboard.json`. When prompted, pick your metrics data source
(`grafanacloud-<stack>-prom`). Panels: request rate by route, 5xx error %, p95/p99 latency,
active WebSocket connections.

Or build by hand from the core PromQL:

```promql
# Rate (req/s) by route
sum(rate(http_server_request_duration_seconds_count[5m])) by (http_route)

# Error % (5xx)
sum(rate(http_server_request_duration_seconds_count{http_response_status_code=~"5.."}[5m]))
  / sum(rate(http_server_request_duration_seconds_count[5m]))

# p99 latency (measure percentiles, not averages)
histogram_quantile(0.99,
  sum(rate(http_server_request_duration_seconds_bucket[5m])) by (le))

# Active WebSocket connections (saturation)
app_socket_connections_active
```

> Metric names follow OTel→Prometheus conversion (dots → underscores, `_seconds`
> unit suffix). If yours differ, browse the metric list in Grafana Explore.

## Alerts — symptom-based, actionable, tiered

Create in **Grafana → Alerting → Alert rules**. Page only on user-facing symptoms:

| Alert | Query (Grafana-managed rule) | Fires when | Tier |
|-------|------------------------------|------------|------|
| High error rate | `sum(rate(http_server_request_duration_seconds_count{http_response_status_code=~"5.."}[5m])) / clamp_min(sum(rate(http_server_request_duration_seconds_count[5m])),1e-9)` | `> 0.01` for 5m | Page |
| High p99 latency | `histogram_quantile(0.99, sum(rate(http_server_request_duration_seconds_bucket[5m])) by (le))` | `> 1` for 5m | Page |
| No telemetry / API down | `sum(rate(http_server_request_duration_seconds_count[5m]))` | `< 0.001` (or `NoData`) for 5m | Page |

**Create each rule:** Alerting → **Alert rules → New alert rule** → data source = your Mimir/Prom →
paste query (reduce = `Last`, condition = `IS ABOVE`/`IS BELOW` per table) → `for = 5m` →
pick a folder + notification contact point. For "API down", set **Alert state if no data =
Alerting** so a silent exporter still pages.

Skip cause-based noise (CPU 90%, disk 70%) — investigate those via dashboards, don't page.
Every alert must be actionable; if you don't know what to do when it fires, delete it.

## Troubleshooting

- **No data in Grafana** → check `OTEL_EXPORTER_OTLP_HEADERS` base64 auth; watch API
  logs for `[otel] telemetry started → …`. Missing = endpoint env var not set.
- **Spans but no DB spans** → telemetry didn't load before `pg`; confirm the
  `--require` preload (prod) / first-import (dev) is intact.
- **Metric name mismatch in PromQL** → list metrics in Grafana Explore; OTel unit
  suffixes (`_seconds`, `_total`) vary by exporter version.
