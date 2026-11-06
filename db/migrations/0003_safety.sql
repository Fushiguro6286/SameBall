CREATE TABLE "reports" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"reporter_id" text NOT NULL,
	"target_id" text NOT NULL,
	"room_code" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "keyed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "room_members" ADD COLUMN "removed_at" timestamp with time zone;