ALTER TABLE "collaborator_documents" ALTER COLUMN "content" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "content" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "collaborator_documents" ADD COLUMN "storage_path" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "storage_path" text;