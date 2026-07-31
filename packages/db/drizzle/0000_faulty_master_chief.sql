-- Enable pgvector extension for vector similarity search (Phase 08 embeddings)
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
-- Enable pgcrypto for gen_random_uuid() in older PG builds (pg16 has it built-in but safe to add)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
CREATE TABLE "songs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"embedding" vector(768),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"song_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"track" integer NOT NULL,
	"time_tick" integer NOT NULL,
	"color" text DEFAULT '#22d3ee' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_notes_song_track_tick" UNIQUE("song_id","track","time_tick"),
	CONSTRAINT "chk_notes_track" CHECK ("notes"."track" BETWEEN 1 AND 8),
	CONSTRAINT "chk_notes_time_tick" CHECK ("notes"."time_tick" BETWEEN 0 AND 1200)
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"song_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"note_id" uuid,
	"payload" jsonb NOT NULL,
	"actor" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_notes_song_id" ON "notes" USING btree ("song_id");--> statement-breakpoint
CREATE INDEX "idx_events_song_id_id" ON "events" USING btree ("song_id","id");