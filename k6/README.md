# k6 Load Tests

Performance deliverable for AMA-MIDI. Exercises the two hot paths — concurrent
note creation and song search — against the real API + Postgres/Redis stack.

## Prerequisites

```bash
# 1. Infra + API up
docker compose up -d                 # Postgres + Redis
pnpm --filter @ama-midi/api dev      # API on :3000

# 2. Install k6 (once)
brew install k6                      # macOS  (or: https://k6.io/docs/get-started/installation/)
```

## Run

```bash
k6 run k6/note-creation-load.js
k6 run k6/search-load.js

# Against a deployed API:
k6 run -e BASE_URL=https://your-api.example.com k6/note-creation-load.js
```

## Scenarios & Thresholds

| Script                   | VUs | Duration | Threshold                              |
|--------------------------|-----|----------|----------------------------------------|
| `note-creation-load.js`  | 50  | 30s      | p95 < 500ms, failed < 1%               |
| `search-load.js`         | 20  | 30s      | p95 < 300ms, failed < 1%               |

Each VU authenticates once (Better Auth email/password) and owns its own song,
so writes never collide — a non-2xx therefore indicates a real failure, not an
expected 409 conflict.

## Recording Results

Capture the summary for the case-study write-up:

```bash
k6 run --summary-export=k6/results-notes.json k6/note-creation-load.js
k6 run --summary-export=k6/results-search.json k6/search-load.js
```

> k6 is intentionally **not** wired into CI (it needs a warm, representative
> environment). Run locally / against staging and paste the `http_req_duration`
> percentiles into the docs.
