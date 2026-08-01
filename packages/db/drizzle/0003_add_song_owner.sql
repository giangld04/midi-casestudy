ALTER TABLE "songs" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "songs" ADD CONSTRAINT "songs_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
