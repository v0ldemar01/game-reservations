-- Enums
CREATE TYPE "Role" AS ENUM ('ADMIN', 'PLAYER');
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- Users
CREATE TABLE "users" (
  "id"            SERIAL      NOT NULL,
  "email"         TEXT        NOT NULL,
  "password_hash" TEXT        NOT NULL,
  "role"          "Role"      NOT NULL DEFAULT 'PLAYER',
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- Arenas
CREATE TABLE "arenas" (
  "id"         SERIAL      NOT NULL,
  "name"       TEXT        NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "arenas_pkey" PRIMARY KEY ("id")
);

-- Recurring groups: stores the weekly booking rule; sessions are created eagerly per occurrence
CREATE TABLE "recurring_groups" (
  "id"          SERIAL      NOT NULL,
  "arena_id"    INTEGER     NOT NULL,
  "user_id"     INTEGER     NOT NULL,
  "day_of_week" INTEGER     NOT NULL,
  "start_hour"  INTEGER     NOT NULL,
  "start_min"   INTEGER     NOT NULL,
  "end_hour"    INTEGER     NOT NULL,
  "end_min"     INTEGER     NOT NULL,
  "weeks_ahead" INTEGER     NOT NULL DEFAULT 4,
  "player_name" TEXT,
  "comment"     TEXT,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recurring_groups_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "recurring_groups"
  ADD CONSTRAINT "recurring_groups_arena_id_fkey"
  FOREIGN KEY ("arena_id") REFERENCES "arenas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recurring_groups"
  ADD CONSTRAINT "recurring_groups_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sessions
CREATE TABLE "sessions" (
  "id"                 SERIAL          NOT NULL,
  "arena_id"           INTEGER         NOT NULL,
  "start_time"         TIMESTAMPTZ     NOT NULL,
  "end_time"           TIMESTAMPTZ     NOT NULL,
  "player_name"        TEXT,
  "comment"            TEXT,
  "status"             "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at"         TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMPTZ     NOT NULL,
  "user_id"            INTEGER,
  "recurring_group_id" INTEGER,
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- Duration constraint: min 5 min, max 24 hours, end > start
ALTER TABLE "sessions"
  ADD CONSTRAINT "valid_duration" CHECK (
    end_time > start_time
    AND EXTRACT(EPOCH FROM (end_time - start_time)) >= 300
    AND EXTRACT(EPOCH FROM (end_time - start_time)) <= 86400
  );

ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_arena_id_fkey"
  FOREIGN KEY ("arena_id") REFERENCES "arenas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_recurring_group_id_fkey"
  FOREIGN KEY ("recurring_group_id") REFERENCES "recurring_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes for overlap queries and date-range listing
CREATE INDEX "idx_sessions_arena_time_range" ON "sessions"("arena_id", "start_time", "end_time");
CREATE INDEX "idx_sessions_arena_start"      ON "sessions"("arena_id", "start_time");

-- Waitlist entries
CREATE TABLE "waitlist_entries" (
  "id"           SERIAL      NOT NULL,
  "arena_id"     INTEGER     NOT NULL,
  "user_id"      INTEGER     NOT NULL,
  "start_time"   TIMESTAMPTZ NOT NULL,
  "end_time"     TIMESTAMPTZ NOT NULL,
  "notified_at"  TIMESTAMPTZ,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "waitlist_entries_arena_id_start_time_end_time_idx"
  ON "waitlist_entries"("arena_id", "start_time", "end_time");

ALTER TABLE "waitlist_entries"
  ADD CONSTRAINT "waitlist_entries_arena_id_fkey"
  FOREIGN KEY ("arena_id") REFERENCES "arenas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "waitlist_entries"
  ADD CONSTRAINT "waitlist_entries_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
