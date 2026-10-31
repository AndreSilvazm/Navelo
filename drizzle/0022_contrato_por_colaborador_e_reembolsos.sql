CREATE TYPE "public"."reimbursement_status" AS ENUM('submitted', 'approved', 'rejected', 'paid');--> statement-breakpoint
CREATE TABLE "contract_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"title" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_path" text NOT NULL,
	"uploaded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contract_files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reimbursement_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"reimbursement_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reimbursement_files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reimbursements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"collaborator_id" uuid NOT NULL,
	"contract_id" uuid,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"merchant" text,
	"trip" text,
	"expense_date" date NOT NULL,
	"amount_cents" bigint NOT NULL,
	"status" "reimbursement_status" DEFAULT 'submitted' NOT NULL,
	"review_note" text,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_user_id" uuid,
	"paid_at" timestamp with time zone,
	"paid_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reimbursements_amount_positive" CHECK ("reimbursements"."amount_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "reimbursements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "collaborator_id" uuid;--> statement-breakpoint
ALTER TABLE "contract_files" ADD CONSTRAINT "contract_files_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_files" ADD CONSTRAINT "contract_files_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_files" ADD CONSTRAINT "contract_files_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_files" ADD CONSTRAINT "reimbursement_files_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_files" ADD CONSTRAINT "reimbursement_files_reimbursement_id_reimbursements_id_fk" FOREIGN KEY ("reimbursement_id") REFERENCES "public"."reimbursements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_collaborator_id_collaborators_id_fk" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_paid_by_user_id_users_id_fk" FOREIGN KEY ("paid_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contract_files_contract_idx" ON "contract_files" USING btree ("contract_id","created_at");--> statement-breakpoint
CREATE INDEX "reimbursement_files_reimbursement_idx" ON "reimbursement_files" USING btree ("reimbursement_id");--> statement-breakpoint
CREATE INDEX "reimbursements_company_idx" ON "reimbursements" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "reimbursements_collaborator_idx" ON "reimbursements" USING btree ("collaborator_id","expense_date");--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_collaborator_id_collaborators_id_fk" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
-- ---- dados: cada contrato passa a ter UM colaborador ----------------------------------
-- Antes, um contrato podia ter vários colaboradores (contract_collaborators). O vínculo mais
-- antigo fica com o contrato original; cada colaborador a mais ganha uma cópia do contrato
-- (mesmos dados e exigências, nome com o da pessoa) e as notas dele passam para a cópia.
-- A tabela contract_collaborators NÃO é apagada: fica sem uso, como registro do que existia.
DO $mig$
declare
  c record;
  l record;
  eh_primeiro boolean;
  novo uuid;
  nome_novo text;
begin
  for c in
    select k.id from contracts k
    where k.collaborator_id is null
      and exists (select 1 from contract_collaborators cc where cc.contract_id = k.id)
  loop
    eh_primeiro := true;
    for l in
      select cc.collaborator_id, u.name as pessoa
      from contract_collaborators cc
      join collaborators co on co.id = cc.collaborator_id
      join memberships m on m.id = co.membership_id
      join users u on u.id = m.user_id
      where cc.contract_id = c.id
      order by cc.created_at, cc.id
    loop
      if eh_primeiro then
        update contracts set collaborator_id = l.collaborator_id where id = c.id;
        eh_primeiro := false;
      else
        novo := gen_random_uuid();
        select k.name || ' (' || l.pessoa || ')' into nome_novo from contracts k where k.id = c.id;
        if exists (select 1 from contracts k2 where k2.company_id = (select company_id from contracts where id = c.id) and lower(k2.name) = lower(nome_novo)) then
          nome_novo := nome_novo || ' ' || substr(novo::text, 1, 4);
        end if;
        insert into contracts (id, company_id, name, description, status, start_date, end_date, amount_cents,
                               invoice_due_day, responsible_user_id, created_by_user_id, collaborator_id, created_at, updated_at)
        select novo, company_id, nome_novo, description, status, start_date, end_date, amount_cents,
               invoice_due_day, responsible_user_id, created_by_user_id, l.collaborator_id, created_at, updated_at
        from contracts where id = c.id;
        insert into contract_requirements (contract_id, name, required, created_at)
        select novo, name, required, created_at from contract_requirements where contract_id = c.id;
        update invoices set contract_id = novo where contract_id = c.id and collaborator_id = l.collaborator_id;
      end if;
    end loop;
  end loop;

  -- colaborador que ficou com mais de um contrato ativo: só o mais recente continua ativo;
  -- os anteriores passam a "encerrado" (continuam no histórico)
  update contracts k set status = 'ended'
  where k.status = 'active' and k.collaborator_id is not null
    and exists (
      select 1 from contracts o
      where o.collaborator_id = k.collaborator_id and o.status = 'active'
        and (o.created_at, o.id) > (k.created_at, k.id)
    );
end
$mig$;
--> statement-breakpoint
CREATE UNIQUE INDEX "contracts_collaborator_key" ON "contracts" USING btree ("collaborator_id") WHERE "contracts"."status" = 'active' and "contracts"."collaborator_id" is not null;
--> statement-breakpoint
-- =====================================================================================
-- RLS e permissões das tabelas novas e do contrato com colaborador único
-- (mesmo modelo da 0021: sem contexto, nenhuma linha aparece)
-- =====================================================================================

alter table contract_files        enable row level security, force row level security;
--> statement-breakpoint
alter table reimbursements        enable row level security, force row level security;
--> statement-breakpoint
alter table reimbursement_files   enable row level security, force row level security;
--> statement-breakpoint
-- O contrato agora é do colaborador que está nele (contracts.collaborator_id)
create or replace function app.contract_mine(p_id uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as
$$ select exists (
     select 1 from contracts k
     join collaborators c on c.id = k.collaborator_id
     where k.id = p_id and c.membership_id = app.mid()
   ) $$;
--> statement-breakpoint
-- pedido de reembolso visível para quem pede (o colaborador dono) e para o corporativo da empresa
create or replace function app.reimb_read(p_id uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as
$$ select exists (
     select 1 from reimbursements r
     where r.id = p_id and r.company_id = app.cid()
       and (app.is_corporate() or exists (select 1 from collaborators c where c.id = r.collaborator_id and c.membership_id = app.mid()))
   ) $$;
--> statement-breakpoint
-- pedido do próprio colaborador e ainda em revisão: só nele dá para anexar comprovante
create or replace function app.reimb_open_own(p_id uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as
$$ select exists (
     select 1 from reimbursements r
     join collaborators c on c.id = r.collaborator_id
     where r.id = p_id and r.company_id = app.cid() and r.status = 'submitted' and c.membership_id = app.mid()
   ) $$;
--> statement-breakpoint
revoke all on function app.reimb_read(uuid), app.reimb_open_own(uuid) from public;
--> statement-breakpoint
-- ---- contratos: o colaborador do contrato precisa ser da mesma empresa --------------
drop policy if exists contracts_insert on contracts;
--> statement-breakpoint
create policy contracts_insert on contracts for insert
  with check (company_id = app.cid() and app.is_corporate() and (collaborator_id is null or app.collab_corp(collaborator_id)));
--> statement-breakpoint
drop policy if exists contracts_update on contracts;
--> statement-breakpoint
create policy contracts_update on contracts for update
  using (company_id = app.cid() and app.is_corporate())
  with check (company_id = app.cid() and app.is_corporate() and (collaborator_id is null or app.collab_corp(collaborator_id)));
--> statement-breakpoint
-- ---- arquivos do contrato: só o corporativo ------------------------------------------
drop policy if exists contract_files_select on contract_files;
--> statement-breakpoint
create policy contract_files_select on contract_files for select
  using (company_id = app.cid() and app.contract_corp(contract_id));
--> statement-breakpoint
drop policy if exists contract_files_insert on contract_files;
--> statement-breakpoint
create policy contract_files_insert on contract_files for insert
  with check (company_id = app.cid() and app.contract_corp(contract_id));
--> statement-breakpoint
drop policy if exists contract_files_delete on contract_files;
--> statement-breakpoint
create policy contract_files_delete on contract_files for delete
  using (company_id = app.cid() and app.contract_corp(contract_id));
--> statement-breakpoint
-- ---- reembolsos -----------------------------------------------------------------------
drop policy if exists reimbursements_select on reimbursements;
--> statement-breakpoint
create policy reimbursements_select on reimbursements for select
  using (company_id = app.cid() and (app.is_corporate() or app.collab_own(collaborator_id)));
--> statement-breakpoint
-- o pedido nasce sempre "em revisão": ninguém cria um reembolso já aprovado ou pago
drop policy if exists reimbursements_insert on reimbursements;
--> statement-breakpoint
create policy reimbursements_insert on reimbursements for insert
  with check (company_id = app.cid() and app.collab_own(collaborator_id)
              and status = 'submitted' and reviewed_at is null and paid_at is null);
--> statement-breakpoint
drop policy if exists reimbursements_update on reimbursements;
--> statement-breakpoint
create policy reimbursements_update on reimbursements for update
  using (company_id = app.cid() and app.is_corporate()) with check (company_id = app.cid() and app.is_corporate());
--> statement-breakpoint
drop policy if exists reimbursement_files_select on reimbursement_files;
--> statement-breakpoint
create policy reimbursement_files_select on reimbursement_files for select
  using (company_id = app.cid() and app.reimb_read(reimbursement_id));
--> statement-breakpoint
drop policy if exists reimbursement_files_insert on reimbursement_files;
--> statement-breakpoint
create policy reimbursement_files_insert on reimbursement_files for insert
  with check (company_id = app.cid() and app.reimb_open_own(reimbursement_id));
--> statement-breakpoint
-- ---- permissões por tabela (só se os papéis existirem) --------------------------------
do $perm$
begin
  -- a API de dados do Supabase não tem motivo para tocar nestas tabelas
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on contract_files, reimbursements, reimbursement_files from anon';
    execute 'revoke execute on function app.reimb_read(uuid), app.reimb_open_own(uuid) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on contract_files, reimbursements, reimbursement_files from authenticated';
    execute 'revoke execute on function app.reimb_read(uuid), app.reimb_open_own(uuid) from authenticated';
  end if;

  if exists (select 1 from pg_roles where rolname = 'navelo_app') then
    execute 'grant execute on function app.reimb_read(uuid), app.reimb_open_own(uuid) to navelo_app';
    execute 'grant select, insert on contract_files, reimbursements, reimbursement_files to navelo_app';
    execute 'grant update on reimbursements to navelo_app';
    execute 'grant delete on contract_files to navelo_app';
  end if;

  if exists (select 1 from pg_roles where rolname = 'navelo_admin') then
    execute 'grant execute on function app.reimb_read(uuid), app.reimb_open_own(uuid) to navelo_admin';
    execute 'grant select, insert, update, delete on contract_files, reimbursements, reimbursement_files to navelo_admin';
  end if;
end
$perm$;
