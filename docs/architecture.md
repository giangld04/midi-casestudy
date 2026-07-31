# AMA-MIDI Architecture

Diagram-first overview of the system. For phase-by-phase implementation detail see
[`system-architecture.md`](./system-architecture.md); for design rationale see
[`trade-offs.md`](./trade-offs.md).

## System Overview

```mermaid
flowchart LR
  subgraph Browser["Browser — apps/web (React 18 + Vite)"]
    UI["Piano-roll UI<br/>Konva Stage + Layers"]
    SC["socket.io-client<br/>(websocket)"]
    AC["Better Auth client"]
  end

  subgraph Server["apps/api — Node + Express (:3000)"]
    REST["REST routes<br/>/api/songs · /api/notes · /api/songs/search"]
    BA["Better Auth handler<br/>/api/auth/*"]
    IO["Socket.io server<br/>rooms · presence · cursors"]
    SVC["Service layer<br/>note · song · event · search · embedding"]
  end

  subgraph Data["Stateful backends"]
    PG[("PostgreSQL 16<br/>+ pgvector")]
    RD[("Redis 7<br/>Socket.io adapter")]
  end
  GEM["Gemini Embeddings API<br/>gemini-embedding-001 (768-d)"]

  UI -->|"/api proxy (Vite dev)"| REST
  AC -->|cookie session| BA
  SC <-->|"note:* · presence:* · cursor:*"| IO
  REST --> SVC
  IO --> SVC
  BA --> PG
  SVC --> PG
  SVC -.fire-and-forget.-> GEM
  IO <-->|pub/sub fan-out| RD
```

The API and WebSocket share one HTTP server/port. REST and Socket.io mutations flow through
the **same service layer**, so every data-integrity guarantee (atomic cell upsert, optimistic
locking, atomic event append) holds regardless of transport.

## Data Model (ER)

```mermaid
erDiagram
  USER ||--o{ SESSION : has
  USER ||--o{ ACCOUNT : has
  SONG ||--o{ NOTE : contains
  SONG ||--o{ EVENT : records

  SONG {
    uuid id PK
    text title
    text description
    vector embedding "vector(768), nullable"
    timestamptz created_at
    timestamptz updated_at
  }
  NOTE {
    uuid id PK
    uuid song_id FK
    text title
    int track "CHECK 1..8"
    int time_tick "CHECK 0..1200"
    text color "#rrggbb"
    int version "optimistic lock"
    timestamptz created_at
    timestamptz updated_at
  }
  EVENT {
    bigserial id PK "monotonic order"
    uuid song_id FK
    text event_type "note_created|updated|deleted"
    uuid note_id "nullable"
    jsonb payload "full snapshot"
    text actor "user id, nullable"
    timestamptz created_at
  }
```

Integrity invariant: **`UNIQUE(song_id, track, time_tick)`** — at most one note per grid cell.
Auth tables (`user`, `session`, `account`, `verification`) are owned by Better Auth (Kysely).

## Component Layout

```mermaid
flowchart TB
  subgraph web["apps/web"]
    direction TB
    pr["piano-roll/<br/>stage · grid · notes · selection · cursors · fps · note-inspector"]
    collab["collaboration/<br/>presence-indicator"]
    search["search/<br/>semantic-search-bar"]
    auth["auth/<br/>login · user-menu · protected-route"]
    hooks["hooks/<br/>use-realtime-notes · use-socket · use-viewport-culling · use-auth · use-notes"]
    lib["lib/<br/>coordinate-utils · performance-utils · socket-client · auth-client"]
  end
  subgraph api["apps/api"]
    direction TB
    routes["routes/<br/>song · note · search"]
    mw["middleware/<br/>require-auth · rate-limiter · csrf · validate"]
    services["services/<br/>note · song · event · search · embedding"]
    socket["socket/<br/>server · room-handler · note-handler · presence · redis-adapter"]
  end
  subgraph pkg["packages"]
    db["db/ (Drizzle schema + migrations)"]
    shared["shared/ (typed socket events + models)"]
  end
  routes --> mw --> services --> db
  socket --> services
  hooks --> lib
  web -. shared types .-> shared
  api -. shared types .-> shared
```

## Canvas Rendering Pipeline

```mermaid
flowchart LR
  scroll["Container scrollTop"] --> vp["useViewport<br/>→ firstTick / lastTick"]
  vp --> cull["useViewportCulling<br/>filter notes to window"]
  cull --> nl["NotesLayer<br/>(React.memo NoteCircle)"]
  subgraph stage["Konva Stage (one canvas per layer)"]
    gl["GridLayer<br/>static, listening=false"]
    nl
    sl["SelectionLayer"]
    cl["CursorsLayer<br/>remote cursors, non-listening"]
  end
  raf["rAF FPS sampler (dev-only)"] -.-> stage
```

Culling keeps the live Konva node count bounded to the visible tick window, so a 10k-note song
renders with the same per-frame cost as a small one. Vertical zoom is a single `pixelsPerTick`
(2..8) parameter driving all coordinate math.

## Real-Time Note Flow

```mermaid
sequenceDiagram
  participant A as Client A
  participant S as Socket.io server
  participant Svc as note-service (tx)
  participant R as Room (all clients)

  A->>A: optimistic render (temp-reqId)
  A->>S: note:create {songId, reqId, track, timeTick, ...}
  S->>S: precheck — joined room? under rate limit?
  S->>Svc: validate (Zod) → INSERT ... ON CONFLICT DO NOTHING<br/>+ append event (same tx)
  alt success
    Svc-->>S: note row
    S->>R: note:created {note, reqId}
    A->>A: swap temp-reqId → real id
  else conflict / stale / invalid
    Svc-->>S: throw AppError
    S-->>A: note:rejected {reqId, code}
    A->>A: rollback optimistic state + toast
  end
```

Presence (`join-song` → `presence:update`) and live cursors (`cursor:move` → volatile
`cursor:update`) ride the same connection; cursors are ephemeral (never persisted, dropped
under load rather than buffered).

## Cross-Node Scaling

Socket.io uses the Redis adapter so `io.to(room).emit(...)` fans out across API instances via
Redis pub/sub. The adapter attaches best-effort and falls back to the in-memory adapter if Redis
is unavailable (single-node still fully functional).
