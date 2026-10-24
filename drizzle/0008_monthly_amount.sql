ALTER TABLE "collaborators" ADD COLUMN "monthly_amount_cents" bigint;--> statement-breakpoint
ALTER TABLE "collaborators" ADD COLUMN "monthly_amount_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "collaborators" ADD COLUMN "monthly_amount_updated_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "collaborators" ADD CONSTRAINT "collaborators_monthly_amount_updated_by_user_id_users_id_fk" FOREIGN KEY ("monthly_amount_updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;