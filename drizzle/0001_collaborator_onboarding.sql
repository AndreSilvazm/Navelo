CREATE TYPE "public"."collaborator_status" AS ENUM('profile_pending', 'documents_pending', 'in_review', 'active');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('submitted', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "collaborator_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collaborator_id" uuid NOT NULL,
	"requirement_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"content" "bytea" NOT NULL,
	"status" "document_status" DEFAULT 'submitted' NOT NULL,
	"review_note" text,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_user_id" uuid
);
--> statement-breakpoint
ALTER TABLE "collaborator_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "collaborators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"status" "collaborator_status" DEFAULT 'profile_pending' NOT NULL,
	"legal_name" text,
	"trade_name" text,
	"cnpj" char(14),
	"phone" text,
	"zip_code" char(8),
	"street" text,
	"number" text,
	"complement" text,
	"district" text,
	"city" text,
	"state" char(2),
	"profile_completed_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"approved_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collaborators" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "document_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"required" boolean DEFAULT true NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_requirements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "collaborator_documents" ADD CONSTRAINT "collaborator_documents_collaborator_id_collaborators_id_fk" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborator_documents" ADD CONSTRAINT "collaborator_documents_requirement_id_document_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."document_requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborator_documents" ADD CONSTRAINT "collaborator_documents_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborators" ADD CONSTRAINT "collaborators_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborators" ADD CONSTRAINT "collaborators_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborators" ADD CONSTRAINT "collaborators_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requirements" ADD CONSTRAINT "document_requirements_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "collaborator_documents_unique_key" ON "collaborator_documents" USING btree ("collaborator_id","requirement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collaborators_membership_key" ON "collaborators" USING btree ("membership_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collaborators_company_cnpj_key" ON "collaborators" USING btree ("company_id","cnpj");--> statement-breakpoint
CREATE INDEX "collaborators_company_status_idx" ON "collaborators" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "document_requirements_company_idx" ON "document_requirements" USING btree ("company_id");