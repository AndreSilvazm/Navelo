DELETE FROM "sessions";--> statement-breakpoint
DROP INDEX "memberships_company_user_key";--> statement-breakpoint
DROP INDEX "invitations_pending_email_key";--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "membership_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_corporate_key" ON "memberships" USING btree ("company_id","user_id") WHERE "memberships"."role" <> 'collaborator';--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_collaborator_key" ON "memberships" USING btree ("company_id","user_id") WHERE "memberships"."role" = 'collaborator';--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_pending_email_key" ON "invitations" USING btree ("company_id",lower("email"),"role") WHERE "invitations"."accepted_at" is null and "invitations"."revoked_at" is null;