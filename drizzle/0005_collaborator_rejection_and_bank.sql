CREATE TYPE "public"."bank_account_type" AS ENUM('checking', 'savings');--> statement-breakpoint
ALTER TYPE "public"."collaborator_status" ADD VALUE 'rejected';--> statement-breakpoint
ALTER TABLE "collaborators" ADD COLUMN "bank_code" char(3);--> statement-breakpoint
ALTER TABLE "collaborators" ADD COLUMN "bank_name" text;--> statement-breakpoint
ALTER TABLE "collaborators" ADD COLUMN "bank_agency" text;--> statement-breakpoint
ALTER TABLE "collaborators" ADD COLUMN "bank_account" text;--> statement-breakpoint
ALTER TABLE "collaborators" ADD COLUMN "bank_account_type" "bank_account_type";--> statement-breakpoint
ALTER TABLE "collaborators" ADD COLUMN "pix_key" text;--> statement-breakpoint
ALTER TABLE "collaborators" ADD COLUMN "rejected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "collaborators" ADD COLUMN "rejected_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "collaborators" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "collaborators" ADD CONSTRAINT "collaborators_rejected_by_user_id_users_id_fk" FOREIGN KEY ("rejected_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;