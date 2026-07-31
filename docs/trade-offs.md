# Architectural Trade-offs

Key decisions with the alternatives considered and why the choice fits this project's scope
(collaborative piano-roll MIDI editor, case-study scale). Principles applied: **YAGNI, KISS, DRY**.

## 1. Canvas: Konva.js vs PixiJS vs Raw Canvas

| Option | Pros | Cons |
|--------|------|------|
| **Konva.js (chosen)** | Built-in hit-testing, layer model, React bindings (`react-konva`), event API | Canvas2D ceiling vs WebGL |
| PixiJS (WebGL) | Highest raw throughput | Manual hit-testing, more glue, heavier for CRUD-style UI |
| Raw Canvas | Zero deps, full control | Reimplement scene graph, events, layering by hand |

**Why Konva:** the grid is a *scene graph* (selectable notes, drag, per-layer redraw), which is
exactly what Konva provides. We hit the 10k-note @ ~60fps target with **viewport culling + a
static grid layer** instead of WebGL — so PixiJS's raw speed was unnecessary (YAGNI). PixiJS
remains a documented fallback only if Canvas2D becomes the bottleneck.

## 2. ORM: Drizzle vs Prisma

| Option | Pros | Cons |
|--------|------|------|
| **Drizzle (chosen)** | Native `ON CONFLICT DO NOTHING`, explicit transactions, thin runtime, SQL-first, easy `vector(768)` custom type | Younger ecosystem |
| Prisma | Mature tooling, generated client | Heavier runtime/engine, upsert/`CHECK`/pgvector friction, less direct transaction control |

**Why Drizzle:** the integrity model *depends* on database primitives — atomic upsert against
`UNIQUE(song_id, track, time_tick)` and an optimistic-lock `UPDATE ... WHERE version = $n`.
Drizzle exposes these directly with typed SQL and lets Better Auth drive its own tables via
Kysely without adapter peer-dep conflicts.

## 3. Concurrency: Optimistic Locking vs CRDT vs Last-Write-Wins

| Option | Pros | Cons |
|--------|------|------|
| **Optimistic lock (chosen)** | Simple `version` column, deterministic 409 on stale write, no lost updates | Rejects (not merges) simultaneous edits of the same note |
| CRDT | Automatic merge, offline-first | Large complexity/memory; overkill for discrete grid cells |
| Last-Write-Wins | Trivial | Silent data loss on conflict |

**Why optimistic locking:** notes are discrete cells keyed by `(song_id, track, time_tick)`.
Two users targeting the **same** cell is a genuine conflict that should be surfaced, not silently
merged or overwritten. `UNIQUE` handles create-conflicts; `version` handles update-conflicts.
CRDTs solve a problem (free-form concurrent text) we don't have.

## 4. Sessions: Cookie Sessions vs JWT

| Option | Pros | Cons |
|--------|------|------|
| **HttpOnly cookie (chosen)** | Not readable by JS (XSS-safe), server-side revocation, Better Auth default | Needs CSRF defense; same-site setup |
| JWT in localStorage | Stateless, easy cross-domain | XSS-exposed, hard to revoke before expiry |

**Why cookies:** an HttpOnly, SameSite=Lax cookie can't be exfiltrated by injected scripts, and
sessions validate against the DB on every request (cookie cache disabled) → **immediate logout
revocation**. CSRF is covered by an Origin/Referer check on mutating methods. The same cookie
authenticates the Socket.io handshake, so no second token scheme is needed (DRY).

## 5. History: Lightweight Event Ledger vs Full CQRS/Event Sourcing

| Option | Pros | Cons |
|--------|------|------|
| **Append-only ledger (chosen)** | Audit trail + undo material, one `INSERT` inside the mutation tx, current state stays in `notes` | Not a full replay-from-zero system |
| Full CQRS/ES | Rebuildable read models, temporal queries | Separate write/read models, projections, snapshots — heavy for this scope |

**Why lightweight:** we keep authoritative state in the `notes` table and *also* append an
immutable `events` row (with actor + full payload) in the **same transaction**. That yields an
audit trail and the raw material for undo/redo without maintaining projections or a read model.
See [`event-ledger.md`](./event-ledger.md).

## 6. Deploy: Railway vs Fly.io

| Option | Pros | Cons |
|--------|------|------|
| **Railway (chosen)** | Managed Postgres w/ pgvector, simple monorepo deploy, integrated Redis | Fewer edge regions |
| Fly.io | Global edge, fine-grained VMs | More manual DB/pgvector + networking setup |

**Why Railway:** the case study needs Postgres **with pgvector** and Redis alongside a
Turborepo, with minimal ops. Railway's managed data services and straightforward monorepo build
get us there in the fewest steps; global edge distribution isn't a requirement here (YAGNI).

## Deferred by choice (YAGNI)

- **2FA/TOTP** — scaffolded but off; OAuth (Google/GitHub) already satisfies SSO.
- **Embedding retry queue** — auto-embed is fire-and-forget; search degrades to ILIKE, never 500s.
- **Cross-node presence/rate-limit in Redis** — process-local today; single-node correct, noted
  as the multi-node upgrade path.
