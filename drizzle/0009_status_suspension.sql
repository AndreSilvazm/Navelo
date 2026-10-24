ALTER TYPE "public"."collaborator_status" ADD VALUE 'suspended';--> statement-breakpoint
CREATE TABLE "collaborator_status_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collaborator_id" uuid NOT NULL,
	"from_status" "collaborator_status" NOT NULL,
	"to_status" "collaborator_status" NOT NULL,
	"reason" text,
	"by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collaborator_status_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "collaborators" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "collaborators" ADD COLUMN "suspended_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "collaborators" ADD COLUMN "suspension_reason" text;--> statement-breakpoint
ALTER TABLE "collaborator_status_events" ADD CONSTRAINT "collaborator_status_events_collaborator_id_collaborators_id_fk" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborator_status_events" ADD CONSTRAINT "collaborator_status_events_by_user_id_users_id_fk" FOREIGN KEY ("by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collaborator_status_events_collaborator_idx" ON "collaborator_status_events" USING btree ("collaborator_id","created_at");--> statement-breakpoint
ALTER TABLE "collaborators" ADD CONSTRAINT "collaborators_suspended_by_user_id_users_id_fk" FOREIGN KEY ("suspended_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;