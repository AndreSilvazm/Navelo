CREATE TYPE "public"."bank_account_kind" AS ENUM('pj', 'pf');--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "bank_account_kind" NOT NULL,
	"bank_code" char(3) NOT NULL,
	"bank_name" text NOT NULL,
	"bank_agency" text NOT NULL,
	"bank_account" text NOT NULL,
	"bank_account_type" "bank_account_type" NOT NULL,
	"pix_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP INDEX "bank_change_pending_key";--> statement-breakpoint
ALTER TABLE "bank_change_requests" ADD COLUMN "kind" "bank_account_kind" DEFAULT 'pj' NOT NULL;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bank_accounts_user_kind_key" ON "bank_accounts" USING btree ("user_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_change_pending_key" ON "bank_change_requests" USING btree ("collaborator_id","kind") WHERE "bank_change_requests"."status" = 'pending';--> statement-breakpoint
-- ---- dados: a conta que cada pessoa já tinha vira a conta PJ dela em bank_accounts ----------
-- (a conta era única por pessoa e repetida em cada vínculo; fica a do cadastro mais recente)
INSERT INTO "bank_accounts" ("user_id", "kind", "bank_code", "bank_name", "bank_agency", "bank_account", "bank_account_type", "pix_key")
SELECT DISTINCT ON (m.user_id) m.user_id, 'pj', c.bank_code, c.bank_name, c.bank_agency, c.bank_account, c.bank_account_type, c.pix_key
FROM collaborators c
JOIN memberships m ON m.id = c.membership_id
WHERE c.bank_code IS NOT NULL AND c.bank_name IS NOT NULL AND c.bank_agency IS NOT NULL
  AND c.bank_account IS NOT NULL AND c.bank_account_type IS NOT NULL
ORDER BY m.user_id, c.profile_completed_at DESC NULLS LAST, c.updated_at DESC;--> statement-breakpoint
ALTER TABLE "collaborators" DROP COLUMN "bank_code";--> statement-breakpoint
ALTER TABLE "collaborators" DROP COLUMN "bank_name";--> statement-breakpoint
ALTER TABLE "collaborators" DROP COLUMN "bank_agency";--> statement-breakpoint
ALTER TABLE "collaborators" DROP COLUMN "bank_account";--> statement-breakpoint
ALTER TABLE "collaborators" DROP COLUMN "bank_account_type";--> statement-breakpoint
ALTER TABLE "collaborators" DROP COLUMN "pix_key";
--> statement-breakpoint
-- =====================================================================================
-- RLS e permissões de bank_accounts (mesmo modelo da 0021)
--
-- Leitura: a própria pessoa e o corporativo das empresas em que ela é colaboradora.
-- Escrita: NINGUÉM pelo app. Só o usuário navelo_admin, e só nos fluxos do servidor (cadastro inicial
-- e pedido de troca aprovado). Assim a conta de pagamento não muda por um caminho sem análise.
-- =====================================================================================
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
-- a pessoa é colaboradora da empresa da sessão? (SECURITY DEFINER: lê vínculos sem passar pelo RLS deles)
CREATE OR REPLACE FUNCTION app.person_in_company(p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS
$$ SELECT EXISTS (
     SELECT 1 FROM memberships m
     WHERE m.user_id = p_user AND m.company_id = app.cid() AND m.role = 'collaborator' AND m.status <> 'removed'
   ) $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.person_in_company(uuid) FROM PUBLIC;
--> statement-breakpoint
DROP POLICY IF EXISTS bank_accounts_select ON bank_accounts;
--> statement-breakpoint
CREATE POLICY bank_accounts_select ON bank_accounts FOR SELECT
  USING (user_id = app.uid() OR (app.is_corporate() AND app.person_in_company(user_id)));
--> statement-breakpoint
DO $perm$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON bank_accounts FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION app.person_in_company(uuid) FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON bank_accounts FROM authenticated';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION app.person_in_company(uuid) FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'navelo_app') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION app.person_in_company(uuid) TO navelo_app';
    EXECUTE 'GRANT SELECT ON bank_accounts TO navelo_app';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'navelo_admin') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION app.person_in_company(uuid) TO navelo_admin';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON bank_accounts TO navelo_admin';
  END IF;
END
$perm$;
