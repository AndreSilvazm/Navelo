CREATE TYPE "public"."bank_change_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "bank_change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collaborator_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"bank_code" char(3) NOT NULL,
	"bank_name" text NOT NULL,
	"bank_agency" text NOT NULL,
	"bank_account" text NOT NULL,
	"bank_account_type" "bank_account_type" NOT NULL,
	"pix_key" text,
	"status" "bank_change_status" DEFAULT 'pending' NOT NULL,
	"review_note" text,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_change_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bank_change_requests" ADD CONSTRAINT "bank_change_requests_collaborator_id_collaborators_id_fk" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_change_requests" ADD CONSTRAINT "bank_change_requests_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_change_requests" ADD CONSTRAINT "bank_change_requests_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bank_change_pending_key" ON "bank_change_requests" USING btree ("collaborator_id") WHERE "bank_change_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "bank_change_company_idx" ON "bank_change_requests" USING btree ("company_id","status");