ALTER TABLE "rooms" ADD COLUMN "kind" text DEFAULT 'room' NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "try_steps" integer DEFAULT 0 NOT NULL;