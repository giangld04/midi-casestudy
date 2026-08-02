# AMA-MIDI Architecture

Diagram-first overview of the system. For phase-by-phase implementation detail see
[`system-architecture.md`](./system-architecture.md); for design rationale see
[`trade-offs.md`](./trade-offs.md).

## System Overview

Two views: a **structure** map (what talks to what) and an **end-to-end sequence**
(how a session actually flows over time).

### Structure (who connects to whom)

```mermaid
flowchart TB
  U["Browser<br/>React 18 + Konva + socket.io-client"]
  subgraph API["apps/api (:3000) — one HTTP server"]
    T["REST /api/* + Better Auth<br/>+ Socket.io (rooms · presence · cursors)"]
    SVC["Service layer<br/>note · song · event · search · embedding"]
  end
  U -->|"REST + WebSocket (cookie session)"| T
  T --> SVC
  SVC --> PG[("PostgreSQL 16<br/>+ pgvector")]
  T <-->|"pub/sub fan-out"| RD[("Redis 7")]
  SVC -. "fire-and-forget" .-> GEM["Gemini API<br/>gemini-embedding-001 (768-d)"]
```

### End-to-end sequence (over time)

```mermaid
sequenceDiagram
  actor U as User Browser
  participant API as REST API
  participant Auth as Better Auth
  participant IO as Socket.io
  participant SVC as Service layer
  participant PG as Postgres pgvector
  participant RD as Redis
  participant GEM as Gemini

  U->>Auth: login cookie session
  Auth->>PG: validate and store session
  U->>API: GET api/songs load
  API->>SVC: fetch from PG
  U->>IO: connect and join-song cookie auth
  U->>IO: mutate note create update delete
  IO->>SVC: validate and tx upsert plus event
  SVC->>PG: INSERT ON CONFLICT or UPDATE version
  IO->>RD: fan-out broadcast cross-node
  IO-->>U: note created for all clients in room
  SVC->>GEM: embed title desc fire-and-forget
  GEM-->>SVC: 768-d vector stored in PG
  U->>API: GET api/songs/search q
  API->>PG: cosine distance ILIKE fallback
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

Read this as a **dependency chain** (left → right), not a wiring diagram:

```mermaid
flowchart LR
  subgraph web["apps/web"]
    UIweb["UI: piano-roll · search · auth · collaboration"]
    HL["hooks + lib"]
    UIweb --> HL
  end
  subgraph api["apps/api"]
    RT["routes"] --> MW["middleware"] --> SVCc["services"]
    SK["socket handlers"] --> SVCc
  end
  DB["packages/db<br/>(Drizzle schema + migrations)"]
  SH["packages/shared<br/>(typed events + models)"]

  HL -->|"REST + WS"| api
  SVCc --> DB
  web -. shared types .-> SH
  api -. shared types .-> SH
```

Folder detail: `web` = `piano-roll/` (stage·grid·notes·selection·cursors·fps·note-inspector),
`hooks/` (use-realtime-notes·use-socket·use-viewport-culling·use-auth), `lib/`
(coordinate-utils·socket-client·auth-client). `api` = `routes/`, `middleware/`
(require-auth·rate-limiter·csrf·validate), `services/`, `socket/`
(server·room-handler·note-handler·presence·redis-adapter).

## API & Socket Contracts

The complete request/response surface: which REST path, what body struct goes up,
what socket event carries what data, and the two-gate check before every fan-out.

### REST endpoints (path · body · response)

Every `/api/*` route runs the same chain: `requireAuth` (cookie session) →
`rateLimiter` (Redis-backed) → `router` (Zod validate → service → Postgres).

| Method + Path | Body struct | Response |
| --- | --- | --- |
| `GET /health` | — | `{ ok: true }` |
| `GET /api/songs` | — | `{ ok, data: Song[] }` |
| `GET /api/songs/:id` | — | `{ ok, data: Song }` |
| `POST /api/songs` | `createSongSchema` | `201 { ok, data: Song }` |
| `PUT /api/songs/:id` | `updateSongSchema` | `{ ok, data: Song }` |
| `DELETE /api/songs/:id` | — | `204` |
| `GET /api/songs/:songId/notes` | — | `{ ok, data: Note[] }` |
| `POST /api/songs/:songId/notes` | `createNoteSchema` | `201 { ok, data: Note }` |
| `PUT /api/notes/:id` | `updateNoteSchema` | `{ ok, data: Note }` |
| `DELETE /api/notes/:id` | — | `204` |
| `GET /api/songs/search?q=` | query `q` | `{ ok, data: Song[] }` |
| `/api/auth/*` | Better Auth | cookie session |

Note body structs (Zod bounds mirror the DB CHECK constraints, defense-in-depth):

```
createNoteSchema = {
  title:       string 1..255      // required
  description?: string <=1000
  track:       int 1..8           // required (lane)
  timeTick:    int 0..1200        // required (time position)
  color?:      "#rrggbb"
}
updateNoteSchema = {
  title? description? track? timeTick? color?   // all optional
  version:     int >= 0           // REQUIRED → optimistic lock (reject stale writes)
}
```

### Socket events (name · payload)

```
Client → Server                          Server → Client (fanned out to the room)
join-song   {songId, name?}              presence:update {users: PresenceUser[]}
leave-song  {songId}                     cursor:update   {userId, name, color, track, timeTick}
note:create {songId, reqId, title,       cursor:leave    {userId}
             track, timeTick, color?}     note:created    {note, reqId}
note:update {songId, reqId, noteId,      note:updated    {note, reqId}
             version, track?, timeTick?,  note:deleted    {noteId, reqId}
             title?, description?, color?} note:rejected   {reqId, code, error}  (SENDER only)
note:delete {songId, reqId, noteId}
cursor:move {songId, track, timeTick}
```

`reqId` is a client-generated nonce: the sender renders an optimistic temp note, and
the server echoes `reqId` back on `note:created` so the sender can swap temp → real id.

### End-to-end + the fan-out gate

```mermaid
sequenceDiagram
  actor A as Client A
  participant B as Client B same room
  participant IO as Socket.io server
  participant PS as presence-store RAM
  participant RL as RateLimiter Redis
  participant SVC as note-service tx
  participant PG as Postgres
  participant RD as Redis adapter

  Note over A,IO: 1. Join
  A->>IO: join-song {songId}
  IO->>PS: addMember(socket.id, songId)
  IO-->>A: presence:update {users}
  IO-->>B: presence:update {users}

  Note over A,PG: 2. Create note (optimistic)
  A->>A: render temp note (reqId)
  A->>IO: note:create {songId, reqId, track, timeTick, color}

  Note over IO,RL: 3. Two-gate check before fan-out
  IO->>PS: getMemberSongId(socket.id) == songId ?
  alt not joined
    IO-->>A: note:rejected {FORBIDDEN}
  else joined
    IO->>RL: take(userId) under 60/min ?
    alt over limit
      IO-->>A: note:rejected {RATE_LIMIT}
    else ok
      IO->>SVC: Zod validate + INSERT ON CONFLICT + append event (1 tx)
      alt duplicate cell / invalid
        SVC-->>IO: throw AppError
        IO-->>A: note:rejected {CONFLICT/VALIDATION}
        A->>A: rollback temp note
      else success
        SVC->>PG: persist note + event
        IO->>RD: fan-out via Redis pub/sub (cross-node)
        IO-->>A: note:created {note, reqId}
        IO-->>B: note:created {note, reqId}
        A->>A: swap temp note to real id
      end
    end
  end
```

The **fan-out gate** (in `note-event-handler.ts` `precheck`) is two checks:
1. **Joined the room?** `getMemberSongId(socket.id) === songId` else `FORBIDDEN`
   (blocks editing an arbitrary song by guessing its UUID).
2. **Under rate limit?** `limiter.take(userId)` (60/min, keyed by user across tabs/nodes)
   else `RATE_LIMIT`.

Past both gates, the service transaction runs and `io.to(room).emit(...)` is the fan-out
point — the Redis adapter republishes to every API node via pub/sub, so Client B receives
the event even when connected to a different node.

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
  participant Svc as note-service tx
  participant R as Room all clients

  A->>A: optimistic render temp-reqId
  A->>S: note:create {songId, reqId, track, timeTick}
  S->>S: precheck joined room and under rate limit
  S->>Svc: validate Zod then INSERT ON CONFLICT DO NOTHING plus append event
  alt success
    Svc-->>S: note row
    S->>R: note:created {note, reqId}
    A->>A: swap temp-reqId to real id
  else conflict or stale or invalid
    Svc-->>S: throw AppError
    S-->>A: note:rejected {reqId, code}
    A->>A: rollback optimistic state plus toast
  end
```

Presence (`join-song` → `presence:update`) and live cursors (`cursor:move` → volatile
`cursor:update`) ride the same connection; cursors are ephemeral (never persisted, dropped
under load rather than buffered).

## Note Lifecycle (state)

```mermaid
stateDiagram-v2
  [*] --> Optimistic: user draws (temp reqId)
  Optimistic --> Confirmed: note:created (swap temp to real id)
  Optimistic --> Rolledback: note:rejected (conflict/stale/invalid)
  Rolledback --> [*]
  Confirmed --> Confirmed: update (version + 1, CAS)
  Confirmed --> Deleted: delete (idempotent)
  Deleted --> [*]
```

A note is rendered locally the instant a user draws it (Optimistic), then either promoted on the
server echo (Confirmed) or rolled back on `note:rejected`. Updates advance the `version` (optimistic
lock); deletes are idempotent and always win.

## Cross-Node Scaling

Socket.io uses the Redis adapter so `io.to(room).emit(...)` fans out across API instances via
Redis pub/sub. The adapter attaches best-effort and falls back to the in-memory adapter if Redis
is unavailable (single-node still fully functional).
