CREATE TABLE "nc_messages" (
	"message_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"message_type" text NOT NULL,
	"lag" integer,
	"sent_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "nc_messages_sent_idx" ON "nc_messages" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "nc_messages_channel_idx" ON "nc_messages" USING btree ("channel_id");