# Game Arena Reservations

A full-stack booking system for game arenas with GraphQL API, built with NestJS + Prisma + React.

## Stack

| Layer    | Technology                                    |
| -------- | --------------------------------------------- |
| Backend  | Node.js 22, NestJS, Apollo Server, Prisma ORM |
| Database | PostgreSQL 16                                 |
| Frontend | React 18, Apollo Client, Tailwind CSS, Vite   |
| Shared   | TypeScript package — domain types + constants |
| Monorepo | pnpm workspaces                               |
| Language | TypeScript (strict mode, throughout)          |

---

## Project Structure

```
game-reservations/
├── apps/
│   ├── backend/
│   │   ├── prisma/
│   │   │   ├── schema.prisma          # Prisma schema + index declarations
│   │   │   ├── migrations/            # SQL migrations (incl. CHECK constraints)
│   │   │   └── seed.ts                # Bulk seed: 1000 arenas × 5 years
│   │   └── src/
│   │       ├── arena/                 # ArenaModule: resolver + service
│   │       ├── session/               # SessionModule: resolver + service + DTOs + models
│   │       ├── auth/                  # JWT auth (register/login), guards, decorators
│   │       ├── user/                  # UserModule (used by AuthModule)
│   │       ├── recurring/             # RecurringModule: weekly booking groups
│   │       ├── waitlist/              # WaitlistModule: queue + notification stamp
│   │       ├── export/                # REST GET /export/sessions (CSV & ICS)
│   │       ├── analytics/             # AnalyticsModule: daily utilization + peak hours
│   │       ├── health/                # GET /health via @nestjs/terminus
│   │       ├── prisma/                # Global PrismaModule + PrismaService
│   │       ├── config/                # Joi env-var validation schema
│   │       ├── common/
│   │       │   ├── advisory-locks.ts  # FNV-hashed lock key builders
│   │       │   ├── filters/           # GraphQLHttpExceptionFilter
│   │       │   └── pipes/             # Custom validation pipes
│   │       ├── app.module.ts
│   │       └── main.ts
│   └── frontend/
│       └── src/
│           ├── components/
│           │   ├── arena/             # ArenaList, ArenaView
│           │   ├── session/           # SessionList, SessionCard, SessionForm,
│           │   │                      #   TimelineView, WeekView
│           │   ├── analytics/         # AnalyticsView (recharts)
│           │   ├── waitlist/          # WaitlistPanel
│           │   └── ui/                # Button, Modal, Spinner, ErrorMessage
│           ├── contexts/              # AuthContext (JWT + localStorage)
│           ├── graphql/               # Apollo client, queries, mutations
│           ├── types/                 # Frontend-only types (re-exports shared)
│           └── utils/                 # date.ts, export.ts (CSV/ICS download)
├── packages/
│   └── shared/                        # @game-reservations/shared
│       └── src/
│           ├── constants.ts           # Business constants (limits, durations)
│           ├── types.ts               # GraphQL API contract interfaces
│           └── index.ts
├── .env.example                       # Template for all required env variables
├── docker-compose.yml
├── package.json                       # Root workspace scripts
└── pnpm-workspace.yaml
```

---

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 22+ and pnpm 9+ (for local development)

### Run with Docker

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- GraphQL Playground: http://localhost:3000/graphql
- Health check: http://localhost:3000/health

> **Note:** The `JWT_SECRET` in `docker-compose.yml` is set to a placeholder value.
> For any environment beyond local testing, replace it with a strong random secret
> (at least 32 characters) before building.

### Run Locally (Development)

**1. Install dependencies**

```bash
pnpm install
```

**2. Create the backend env file**

```bash
cp apps/backend/.env.example apps/backend/.env
# Edit apps/backend/.env — set DATABASE_URL and JWT_SECRET (min 32 chars)
```

**3. Create the frontend env file** (optional — defaults work for localhost)

```bash
cp apps/frontend/.env.example apps/frontend/.env
```

**4. Start PostgreSQL**

```bash
docker compose up postgres -d
```

**5. Build the shared package** (required before starting apps)

```bash
pnpm build:shared
```

**6. Run migrations and start the backend**

```bash
cd apps/backend
pnpm db:migrate:dev     # applies migrations + generates Prisma client
pnpm start:dev          # http://localhost:3000/graphql
```

**7. Seed the database** (1000 arenas, 5 years of sessions)

```bash
cd apps/backend
pnpm db:seed
```

**8. Start the frontend**

```bash
cd apps/frontend
pnpm dev                # http://localhost:5173
```

---

## Environment Variables

See [`.env.example`](.env.example) for a full reference. Summary:

| Variable           | Where           | Required | Description                                                   |
| ------------------ | --------------- | -------- | ------------------------------------------------------------- |
| `DATABASE_URL`     | `apps/backend`  | yes      | PostgreSQL connection string                                  |
| `JWT_SECRET`       | `apps/backend`  | yes      | Signing secret, **min 32 characters**                         |
| `PORT`             | `apps/backend`  | no       | HTTP port (default `3000`)                                    |
| `FRONTEND_URL`     | `apps/backend`  | no       | CORS allowed origin (default `localhost:5173`)                |
| `JWT_EXPIRES_IN`   | `apps/backend`  | no       | Token lifetime (default `7d`)                                 |
| `VITE_GRAPHQL_URL` | `apps/frontend` | no       | GraphQL endpoint (default `localhost:3000/graphql`)           |
| `VITE_API_URL`     | `apps/frontend` | no       | REST base URL for export downloads (default `localhost:3000`) |

---

## Running Tests

**Unit tests** (no DB required):

```bash
cd apps/backend
pnpm test
```

**Integration tests** (requires a live PostgreSQL database):

```bash
cd apps/backend
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/game_reservations_test \
pnpm test:e2e
```

The integration suite covers four areas:

| File                                  | What it tests                                                                                  |
| ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `advisory-locks.integration.spec.ts`  | `withAdvisoryLock`, `tryWithAdvisoryLock`, `withAdvisoryXactLock` — acquire, release, rollback |
| `concurrency.integration.spec.ts`     | 10 concurrent `createSession` calls → exactly 5 succeed, 5 are rejected                        |
| `recurring.integration.spec.ts`       | `createRecurring` skips full slots; `cancelGroup` removes all sessions                         |
| `waitlist-notify.integration.spec.ts` | `notifyFirst` stamps exactly one entry; concurrent calls don't double-notify                   |

---

## Shared Package (`@game-reservations/shared`)

Contains code that is identical on both sides of the API boundary:

| Export                    | Description                                                       |
| ------------------------- | ----------------------------------------------------------------- | ------------ |
| `MAX_CONCURRENT_SESSIONS` | Max simultaneous sessions per arena (5)                           |
| `MIN_DURATION_SECONDS`    | Minimum session duration in seconds (300)                         |
| `MAX_DURATION_SECONDS`    | Maximum session duration in seconds (86400)                       |
| `SUGGESTION_SEARCH_DAYS`  | How far ahead to search for suggested slots (14)                  |
| `MAX_SUGGESTIONS`         | Maximum number of slot suggestions returned (3)                   |
| `Arena`                   | GraphQL API contract interface                                    |
| `Session`                 | GraphQL API contract interface (includes `status: SessionStatus`) |
| `SessionStatus`           | `'ACTIVE'                                                         | 'COMPLETED'` |
| `SlotSuggestion`          | GraphQL API contract interface                                    |
| `AvailabilityResult`      | GraphQL API contract interface                                    |

The backend imports constants to drive validation and business logic. The frontend imports types for Apollo Client response typing. Both use the same source of truth — changing a limit in one place propagates to both.

---

## Technical Decisions

### Race Condition Prevention

The core challenge is preventing two concurrent requests from exceeding the 5-session limit.

**Approach: PostgreSQL advisory lock + `SELECT ... FOR UPDATE` + `ReadCommitted`**

For every `createSession` / `updateSession`:

1. Open a `ReadCommitted` transaction
2. Acquire `pg_advisory_xact_lock(arenaId)` — this serializes all writers for the same arena; only one proceeds at a time, the rest queue behind the lock
3. Lock overlapping rows with `SELECT id FROM sessions WHERE … FOR UPDATE` — prevents a row-level race if the advisory lock were ever bypassed
4. `countOverlapping` — if `count >= 5`, throw `ConflictException`; otherwise insert

Because the isolation level is `ReadCommitted`, `countOverlapping` re-reads the latest committed rows at the moment it runs (i.e. after the advisory lock is acquired), not a stale snapshot from transaction start. This is what makes the count correct even under concurrency.

The advisory lock is **transaction-scoped** (`pg_advisory_xact_lock`) so it is automatically released on commit or rollback — no manual unlock, no risk of a leaked lock if the connection is returned to the pool.

This is a **TOCTOU-safe** pattern: the check and the write happen within the same serialized, locked context.

### Overlap Predicate

Two sessions overlap if and only if:

```sql
A.start_time < B.end_time AND A.end_time > B.start_time
```

This **strict inequality** means touching boundaries (`A.end = B.start`) are **not** considered overlapping — matching the business rule that 5 sessions ending at 11:00 and 5 starting at 11:00 is valid.

### Indexes

```sql
-- Used by both the overlap check and concurrent lock acquisition
CREATE INDEX idx_sessions_arena_time_range ON sessions (arena_id, start_time, end_time);

-- Used by the date-range listing query per arena
CREATE INDEX idx_sessions_arena_start ON sessions (arena_id, start_time);
```

The composite index on `(arena_id, start_time, end_time)` means the DB can satisfy the overlap query `WHERE arena_id = X AND start_time < Y AND end_time > Z` with an index range scan, avoiding full table scans even at 5-year / 1000-arena scale.

### Suggested Slots (Optional Feature)

When a slot is unavailable, the service scans forward from all session `end_time` values within the next 14 days as candidate starts. This is efficient because: gaps immediately after existing sessions are the most likely available windows, avoiding an expensive minute-by-minute sweep.

### SOLID Principles Applied

- **SRP**: `SessionService` handles business logic only; `DatabaseService` owns transactions and advisory locks; resolvers handle GraphQL mapping.
- **OCP**: Adding a new validation rule means adding a private method to `SessionService`, not modifying existing logic.
- **LSP**: `Prisma.TransactionClient` type exactly mirrors the Prisma client interface for seamless use inside transactions.
- **ISP**: Each DTO contains only the fields relevant to its operation (Create vs Update vs CheckAvailability are separate types). Repository interfaces (`ISessionRepository`, `IRecurringRepository`, `IWaitlistRepository`, `IAnalyticsRepository`) expose only the methods each service actually needs.
- **DIP**: Services depend on injected repository interfaces (Symbol DI tokens), not concrete Prisma classes. Swapping the storage layer requires only a new class that satisfies the interface — no service changes.
