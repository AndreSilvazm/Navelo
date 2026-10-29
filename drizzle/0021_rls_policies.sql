-- =====================================================================================
-- Políticas de RLS e privilégio mínimo
--
-- A aplicação conecta como `navelo_app`, que NÃO ignora o RLS. Cada transação informa quem
-- está agindo por meio de configurações locais (app.user_id, app.company_id, app.role,
-- app.membership_id), definidas em src/db/index.ts a partir da sessão. Sem contexto, nenhuma
-- linha aparece: a falha é sempre para o lado seguro.
--
-- Fluxos que acontecem ANTES de existir sessão (login, convite, troca de senha) e as tabelas de
-- sistema (sessions, rate_limits, password_resets, escrita em audit_events) usam `navelo_admin`.
-- Os papéis são criados por `npm run db:roles`; aqui só se dão as permissões, e só se eles
-- existirem (assim a migração roda também em bancos locais sem esses papéis).
-- =====================================================================================

create schema if not exists app;
--> statement-breakpoint
-- ---- contexto da requisição ---------------------------------------------------------

create or replace function app.uid() returns uuid language sql stable as
$$ select nullif(current_setting('app.user_id', true), '')::uuid $$;
--> statement-breakpoint
create or replace function app.cid() returns uuid language sql stable as
$$ select nullif(current_setting('app.company_id', true), '')::uuid $$;
--> statement-breakpoint
create or replace function app.mid() returns uuid language sql stable as
$$ select nullif(current_setting('app.membership_id', true), '')::uuid $$;
--> statement-breakpoint
create or replace function app.role() returns text language sql stable as
$$ select nullif(current_setting('app.role', true), '') $$;
--> statement-breakpoint
create or replace function app.is_corporate() returns boolean language sql stable as
$$ select coalesce(app.role() in ('owner', 'admin', 'agent'), false) $$;
--> statement-breakpoint
create or replace function app.is_manager() returns boolean language sql stable as
$$ select coalesce(app.role() in ('owner', 'admin'), false) $$;
--> statement-breakpoint
-- ---- verificações que atravessam tabelas --------------------------------------------
-- SECURITY DEFINER: leem a tabela sem passar pelo RLS dela, o que evita recursão infinita
-- entre políticas (contratos <-> vínculos). Só devolvem verdadeiro ou falso para um id que a
-- pessoa já tem em mãos, então não vazam dados.

create or replace function app.collab_read(p_id uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as
$$ select exists (
     select 1 from collaborators c
     where c.id = p_id
       and ((c.company_id = app.cid() and (app.is_corporate() or c.membership_id = app.mid()))
            or c.membership_id in (select m.id from memberships m where m.user_id = app.uid()))
   ) $$;
--> statement-breakpoint
create or replace function app.collab_corp(p_id uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as
$$ select app.is_corporate() and exists (select 1 from collaborators c where c.id = p_id and c.company_id = app.cid()) $$;
--> statement-breakpoint
create or replace function app.collab_own(p_id uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as
$$ select exists (select 1 from collaborators c where c.id = p_id and c.membership_id = app.mid()) $$;
--> statement-breakpoint
create or replace function app.contract_corp(p_id uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as
$$ select app.is_corporate() and exists (select 1 from contracts k where k.id = p_id and k.company_id = app.cid()) $$;
--> statement-breakpoint
create or replace function app.contract_mine(p_id uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as
$$ select exists (
     select 1 from contract_collaborators cc
     join collaborators c on c.id = cc.collaborator_id
     where cc.contract_id = p_id and c.membership_id = app.mid()
   ) $$;
--> statement-breakpoint
revoke all on function app.collab_read(uuid), app.collab_corp(uuid), app.collab_own(uuid),
                       app.contract_corp(uuid), app.contract_mine(uuid) from public;
--> statement-breakpoint
-- ---- RLS ligado e FORÇADO em todas as tabelas --------------------------------------
-- FORCE faz o RLS valer até para o dono da tabela (papéis com BYPASSRLS continuam ignorando).

alter table companies                   enable row level security, force row level security;
--> statement-breakpoint
alter table users                       enable row level security, force row level security;
--> statement-breakpoint
alter table memberships                 enable row level security, force row level security;
--> statement-breakpoint
alter table invitations                 enable row level security, force row level security;
--> statement-breakpoint
alter table sessions                    enable row level security, force row level security;
--> statement-breakpoint
alter table collaborators               enable row level security, force row level security;
--> statement-breakpoint
alter table document_requirements       enable row level security, force row level security;
--> statement-breakpoint
alter table collaborator_documents      enable row level security, force row level security;
--> statement-breakpoint
alter table contracts                   enable row level security, force row level security;
--> statement-breakpoint
alter table contract_collaborators      enable row level security, force row level security;
--> statement-breakpoint
alter table contract_requirements       enable row level security, force row level security;
--> statement-breakpoint
alter table invoices                    enable row level security, force row level security;
--> statement-breakpoint
alter table collaborator_status_events  enable row level security, force row level security;
--> statement-breakpoint
alter table bank_change_requests        enable row level security, force row level security;
--> statement-breakpoint
alter table audit_events                enable row level security, force row level security;
--> statement-breakpoint
alter table rate_limits                 enable row level security, force row level security;
--> statement-breakpoint
alter table password_resets             enable row level security, force row level security;
--> statement-breakpoint
-- ---- companies ----------------------------------------------------------------------
drop policy if exists companies_select on companies;
--> statement-breakpoint
create policy companies_select on companies for select
  using (id = app.cid() or id in (select m.company_id from memberships m where m.user_id = app.uid()));
--> statement-breakpoint
drop policy if exists companies_update on companies;
--> statement-breakpoint
create policy companies_update on companies for update
  using (id = app.cid() and app.is_manager()) with check (id = app.cid() and app.is_manager());
--> statement-breakpoint
-- ---- users: a própria pessoa e quem trabalha na mesma empresa --------------------------
-- O colaborador não enxerga os colegas colaboradores: só o corporativo e ele mesmo.
drop policy if exists users_select on users;
--> statement-breakpoint
create policy users_select on users for select
  using (
    id = app.uid()
    or exists (
      select 1 from memberships m
      where m.user_id = users.id and m.company_id = app.cid()
        and (app.is_corporate() or m.role <> 'collaborator')
    )
  );
--> statement-breakpoint
-- ---- memberships --------------------------------------------------------------------
drop policy if exists memberships_select on memberships;
--> statement-breakpoint
create policy memberships_select on memberships for select
  using (user_id = app.uid() or (company_id = app.cid() and (app.is_corporate() or role <> 'collaborator')));
--> statement-breakpoint
-- ---- invitations (só o corporativo da empresa) --------------------------------------
drop policy if exists invitations_select on invitations;
--> statement-breakpoint
create policy invitations_select on invitations for select using (company_id = app.cid() and app.is_corporate());
--> statement-breakpoint
drop policy if exists invitations_insert on invitations;
--> statement-breakpoint
create policy invitations_insert on invitations for insert with check (company_id = app.cid() and app.is_corporate());
--> statement-breakpoint
drop policy if exists invitations_update on invitations;
--> statement-breakpoint
create policy invitations_update on invitations for update
  using (company_id = app.cid() and app.is_corporate()) with check (company_id = app.cid() and app.is_corporate());
--> statement-breakpoint
-- ---- collaborators ------------------------------------------------------------------
drop policy if exists collaborators_select on collaborators;
--> statement-breakpoint
create policy collaborators_select on collaborators for select
  using (
    (company_id = app.cid() and (app.is_corporate() or membership_id = app.mid()))
    or membership_id in (select m.id from memberships m where m.user_id = app.uid())
  );
--> statement-breakpoint
drop policy if exists collaborators_insert on collaborators;
--> statement-breakpoint
create policy collaborators_insert on collaborators for insert with check (membership_id = app.mid());
--> statement-breakpoint
drop policy if exists collaborators_update on collaborators;
--> statement-breakpoint
create policy collaborators_update on collaborators for update
  using ((company_id = app.cid() and app.is_corporate()) or membership_id = app.mid())
  with check ((company_id = app.cid() and app.is_corporate()) or membership_id = app.mid());
--> statement-breakpoint
-- ---- documentos exigidos e enviados -------------------------------------------------
drop policy if exists requirements_select on document_requirements;
--> statement-breakpoint
create policy requirements_select on document_requirements for select using (company_id = app.cid());
--> statement-breakpoint
drop policy if exists requirements_insert on document_requirements;
--> statement-breakpoint
create policy requirements_insert on document_requirements for insert with check (company_id = app.cid() and app.is_corporate());
--> statement-breakpoint
drop policy if exists requirements_update on document_requirements;
--> statement-breakpoint
create policy requirements_update on document_requirements for update
  using (company_id = app.cid() and app.is_corporate()) with check (company_id = app.cid() and app.is_corporate());
--> statement-breakpoint
drop policy if exists docs_select on collaborator_documents;
--> statement-breakpoint
create policy docs_select on collaborator_documents for select using (app.collab_read(collaborator_id));
--> statement-breakpoint
drop policy if exists docs_insert on collaborator_documents;
--> statement-breakpoint
create policy docs_insert on collaborator_documents for insert with check (app.collab_own(collaborator_id));
--> statement-breakpoint
drop policy if exists docs_update on collaborator_documents;
--> statement-breakpoint
create policy docs_update on collaborator_documents for update
  using (app.collab_corp(collaborator_id) or app.collab_own(collaborator_id))
  with check (app.collab_corp(collaborator_id) or app.collab_own(collaborator_id));
--> statement-breakpoint
drop policy if exists status_events_select on collaborator_status_events;
--> statement-breakpoint
create policy status_events_select on collaborator_status_events for select using (app.collab_corp(collaborator_id));
--> statement-breakpoint
drop policy if exists status_events_insert on collaborator_status_events;
--> statement-breakpoint
create policy status_events_insert on collaborator_status_events for insert with check (app.collab_corp(collaborator_id));
--> statement-breakpoint
-- ---- contratos ----------------------------------------------------------------------
drop policy if exists contracts_select on contracts;
--> statement-breakpoint
create policy contracts_select on contracts for select
  using ((company_id = app.cid() and app.is_corporate()) or app.contract_mine(id));
--> statement-breakpoint
drop policy if exists contracts_insert on contracts;
--> statement-breakpoint
create policy contracts_insert on contracts for insert with check (company_id = app.cid() and app.is_corporate());
--> statement-breakpoint
drop policy if exists contracts_update on contracts;
--> statement-breakpoint
create policy contracts_update on contracts for update
  using (company_id = app.cid() and app.is_corporate()) with check (company_id = app.cid() and app.is_corporate());
--> statement-breakpoint
drop policy if exists contract_collabs_select on contract_collaborators;
--> statement-breakpoint
create policy contract_collabs_select on contract_collaborators for select
  using (app.contract_corp(contract_id) or app.collab_own(collaborator_id));
--> statement-breakpoint
drop policy if exists contract_collabs_insert on contract_collaborators;
--> statement-breakpoint
create policy contract_collabs_insert on contract_collaborators for insert with check (app.contract_corp(contract_id));
--> statement-breakpoint
drop policy if exists contract_collabs_delete on contract_collaborators;
--> statement-breakpoint
create policy contract_collabs_delete on contract_collaborators for delete using (app.contract_corp(contract_id));
--> statement-breakpoint
drop policy if exists contract_reqs_select on contract_requirements;
--> statement-breakpoint
create policy contract_reqs_select on contract_requirements for select
  using (app.contract_corp(contract_id) or app.contract_mine(contract_id));
--> statement-breakpoint
drop policy if exists contract_reqs_insert on contract_requirements;
--> statement-breakpoint
create policy contract_reqs_insert on contract_requirements for insert with check (app.contract_corp(contract_id));
--> statement-breakpoint
drop policy if exists contract_reqs_delete on contract_requirements;
--> statement-breakpoint
create policy contract_reqs_delete on contract_requirements for delete using (app.contract_corp(contract_id));
--> statement-breakpoint
-- ---- notas fiscais ------------------------------------------------------------------
drop policy if exists invoices_select on invoices;
--> statement-breakpoint
create policy invoices_select on invoices for select
  using (company_id = app.cid() and (app.is_corporate() or app.collab_own(collaborator_id)));
--> statement-breakpoint
drop policy if exists invoices_insert on invoices;
--> statement-breakpoint
create policy invoices_insert on invoices for insert
  with check (company_id = app.cid() and app.collab_own(collaborator_id));
--> statement-breakpoint
drop policy if exists invoices_update on invoices;
--> statement-breakpoint
create policy invoices_update on invoices for update
  using (company_id = app.cid() and app.is_corporate()) with check (company_id = app.cid() and app.is_corporate());
--> statement-breakpoint
-- ---- troca de conta bancária --------------------------------------------------------
drop policy if exists bank_requests_select on bank_change_requests;
--> statement-breakpoint
create policy bank_requests_select on bank_change_requests for select
  using (company_id = app.cid() and (app.is_corporate() or app.collab_own(collaborator_id)));
--> statement-breakpoint
drop policy if exists bank_requests_insert on bank_change_requests;
--> statement-breakpoint
create policy bank_requests_insert on bank_change_requests for insert
  with check (company_id = app.cid() and app.collab_own(collaborator_id));
--> statement-breakpoint
drop policy if exists bank_requests_update on bank_change_requests;
--> statement-breakpoint
create policy bank_requests_update on bank_change_requests for update
  using (company_id = app.cid() and app.is_corporate()) with check (company_id = app.cid() and app.is_corporate());
--> statement-breakpoint
drop policy if exists bank_requests_delete on bank_change_requests;
--> statement-breakpoint
create policy bank_requests_delete on bank_change_requests for delete using (app.collab_own(collaborator_id));
--> statement-breakpoint
-- ---- auditoria: o corporativo lê; ninguém pelo app escreve --------------------------
drop policy if exists audit_select on audit_events;
--> statement-breakpoint
create policy audit_select on audit_events for select using (company_id = app.cid() and app.is_corporate());
--> statement-breakpoint
-- sessions, rate_limits e password_resets ficam sem política: o app não enxerga nada ali.

-- =====================================================================================
-- Permissões por tabela (privilégio mínimo). Só se aplicam se os papéis existirem.
-- =====================================================================================
do $perm$
begin
  -- A API de dados do Supabase (anon/authenticated) não tem motivo para tocar nestas tabelas
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon';
    execute 'revoke all on all sequences in schema public from anon';
    execute 'revoke execute on all functions in schema app from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on all tables in schema public from authenticated';
    execute 'revoke all on all sequences in schema public from authenticated';
    execute 'revoke execute on all functions in schema app from authenticated';
  end if;

  if exists (select 1 from pg_roles where rolname = 'navelo_app') then
    execute 'revoke all on all tables in schema public from navelo_app';
    execute 'grant usage on schema app to navelo_app';
    execute 'grant execute on all functions in schema app to navelo_app';

    execute 'grant select on companies, users, memberships, invitations, collaborators, document_requirements,
                           collaborator_documents, collaborator_status_events, contracts, contract_collaborators,
                           contract_requirements, invoices, bank_change_requests, audit_events to navelo_app';
    execute 'grant insert on invitations, collaborators, document_requirements, collaborator_documents,
                           collaborator_status_events, contracts, contract_collaborators, contract_requirements,
                           invoices, bank_change_requests to navelo_app';
    -- só o nome de exibição da empresa muda pela aplicação
    execute 'grant update (trade_name) on companies to navelo_app';
    execute 'grant update on invitations, collaborators, document_requirements, collaborator_documents,
                           contracts, invoices, bank_change_requests to navelo_app';
    execute 'grant delete on contract_collaborators, contract_requirements, bank_change_requests to navelo_app';
  end if;

  if exists (select 1 from pg_roles where rolname = 'navelo_admin') then
    execute 'revoke all on all tables in schema public from navelo_admin';
    execute 'grant usage on schema app to navelo_admin';
    execute 'grant execute on all functions in schema app to navelo_admin';
    -- fluxos de sistema: DML nas tabelas, sem alterar estrutura
    execute 'grant select, insert, update, delete on companies, users, memberships, invitations, sessions,
                           collaborators, document_requirements, collaborator_documents, contracts,
                           contract_collaborators, contract_requirements, invoices, collaborator_status_events,
                           bank_change_requests, rate_limits, password_resets to navelo_admin';
    -- a trilha só recebe linhas novas: nem o admin edita ou apaga o que já foi registrado
    execute 'grant select, insert on audit_events to navelo_admin';
  end if;
end
$perm$;
