import { sql } from "drizzle-orm"
import {
  bigint,
  boolean,
  char,
  check,
  customType,
  date,
  index,
  inet,
  integer,
  smallint,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

// RLS fica ligado em todas as tabelas e sem policies: o Data API do Supabase
// (anon/authenticated) não enxerga nada. O backend conecta como `postgres`,
// dono das tabelas, e por isso não é afetado.

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
})

export const companyStatus = pgEnum("company_status", ["active", "suspended"])
export const userStatus = pgEnum("user_status", ["active", "disabled"])
// owner/admin/agent = conta corporativa; collaborator = PJ (portal)
export const membershipRole = pgEnum("membership_role", ["owner", "admin", "agent", "collaborator"])
export const membershipStatus = pgEnum("membership_status", ["active", "suspended", "removed"])
// Ciclo do colaborador PJ: cadastra os dados → envia os documentos → corporativo analisa → ativo
export const collaboratorStatus = pgEnum("collaborator_status", [
  "profile_pending",
  "documents_pending",
  "in_review",
  "active",
  "rejected", // acesso recusado pela empresa
  "suspended", // acesso suspenso pela empresa (reversível)
])
export const bankAccountType = pgEnum("bank_account_type", ["checking", "savings"])
export const contractStatus = pgEnum("contract_status", ["active", "ended", "canceled"])
// Ciclo da nota: em revisão (assim que enviada) -> aprovada pelo corporativo -> paga.
// Aprovar não é pagar: só as notas "paga" contam como valor pago nos dashboards.
export const invoiceStatus = pgEnum("invoice_status", ["submitted", "approved", "rejected", "paid"])
export const documentStatus = pgEnum("document_status", ["submitted", "approved", "rejected"])

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    legalName: text("legal_name").notNull(),
    tradeName: text("trade_name"),
    // só dígitos
    cnpj: char("cnpj", { length: 14 }).notNull(),
    status: companyStatus("status").notNull().default("active"),
    ...timestamps,
  },
  (t) => [uniqueIndex("companies_cnpj_key").on(t.cnpj)],
).enableRLS()

// Identidade global: um PJ pode atender mais de uma empresa com o mesmo login.
// Só nasce quando um convite é aceito — não existe cadastro aberto.
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    // argon2id (formato PHC, inclui salt e parâmetros)
    passwordHash: text("password_hash").notNull(),
    status: userStatus("status").notNull().default("active"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    // aceite dos Termos de Uso e da Política de Privacidade (quando e qual versão)
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
    termsVersion: text("terms_version"),
    ...timestamps,
  },
  (t) => [uniqueIndex("users_email_key").on(sql`lower(${t.email})`)],
).enableRLS()

// Vínculo usuário ↔ empresa, com o papel dele naquela empresa.
export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: membershipRole("role").notNull(),
    status: membershipStatus("status").notNull().default("active"),
    ...timestamps,
  },
  (t) => [
    // Na mesma empresa a pessoa pode ter um papel corporativo (owner/admin/agent) e também ser
    // colaborador: no máximo um vínculo de cada tipo.
    uniqueIndex("memberships_corporate_key").on(t.companyId, t.userId).where(sql`${t.role} <> 'collaborator'`),
    uniqueIndex("memberships_collaborator_key").on(t.companyId, t.userId).where(sql`${t.role} = 'collaborator'`),
    index("memberships_user_idx").on(t.userId),
  ],
).enableRLS()

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name"),
    role: membershipRole("role").notNull(),
    // cargo do colaborador na empresa (só convites de colaborador); copiado para collaborators ao aceitar
    jobTitle: text("job_title"),
    // sha256 do token enviado por e-mail; o token em claro nunca é salvo
    tokenHash: char("token_hash", { length: 64 }).notNull(),
    // null = convite criado pela plataforma (bootstrap do owner)
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedByUserId: uuid("accepted_by_user_id").references(() => users.id, { onDelete: "set null" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("invitations_token_hash_key").on(t.tokenHash),
    // no máximo um convite pendente por e-mail em cada empresa
    uniqueIndex("invitations_pending_email_key")
      .on(t.companyId, sql`lower(${t.email})`, t.role)
      .where(sql`${t.acceptedAt} is null and ${t.revokedAt} is null`),
  ],
).enableRLS()

export const sessions = pgTable(
  "sessions",
  {
    // sha256 do token do cookie
    id: char("id", { length: 64 }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // acesso em uso na sessão: um vínculo (empresa + papel). O usuário pode ter vários.
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => memberships.id, { onDelete: "cascade" }),
    // empresa do vínculo (redundante, mantida para consultas simples)
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
).enableRLS()

// Dados do PJ naquela empresa. Nasce quando o convite de colaborador é aceito;
// os campos de cadastro ficam nulos até ele preencher o primeiro acesso.
export const collaborators = pgTable(
  "collaborators",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => memberships.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    status: collaboratorStatus("status").notNull().default("profile_pending"),
    // cargo definido pela empresa no convite
    jobTitle: text("job_title"),
    // quanto a empresa paga por mês a este colaborador (BRL, em centavos); definido pelo corporativo
    monthlyAmountCents: bigint("monthly_amount_cents", { mode: "number" }),
    monthlyAmountUpdatedAt: timestamp("monthly_amount_updated_at", { withTimezone: true }),
    monthlyAmountUpdatedByUserId: uuid("monthly_amount_updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
    legalName: text("legal_name"),
    tradeName: text("trade_name"),
    cnpj: char("cnpj", { length: 14 }),
    phone: text("phone"),
    zipCode: char("zip_code", { length: 8 }),
    street: text("street"),
    number: text("number"),
    complement: text("complement"),
    district: text("district"),
    city: text("city"),
    state: char("state", { length: 2 }),
    // dados bancários para pagamentos (conta deve ser do CNPJ)
    bankCode: char("bank_code", { length: 3 }),
    bankName: text("bank_name"),
    bankAgency: text("bank_agency"),
    bankAccount: text("bank_account"),
    bankAccountType: bankAccountType("bank_account_type"),
    pixKey: text("pix_key"),
    profileCompletedAt: timestamp("profile_completed_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    rejectedByUserId: uuid("rejected_by_user_id").references(() => users.id, { onDelete: "set null" }),
    rejectionReason: text("rejection_reason"),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    suspendedByUserId: uuid("suspended_by_user_id").references(() => users.id, { onDelete: "set null" }),
    suspensionReason: text("suspension_reason"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("collaborators_membership_key").on(t.membershipId),
    // o mesmo CNPJ não é cadastrado duas vezes na mesma empresa (nulos não contam)
    uniqueIndex("collaborators_company_cnpj_key").on(t.companyId, t.cnpj),
    index("collaborators_company_status_idx").on(t.companyId, t.status),
  ],
).enableRLS()

// Nota fiscal cadastrada pelo colaborador. Número, valor e competência são lidos da nota
// (PDF/XML) e conferidos por quem cadastra; o arquivo fica guardado para a empresa consultar.
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    collaboratorId: uuid("collaborator_id")
      .notNull()
      .references(() => collaborators.id, { onDelete: "cascade" }),
    // contrato a que a nota se refere (nulo se o colaborador não estava em nenhum)
    contractId: uuid("contract_id").references(() => contracts.id, { onDelete: "set null" }),
    number: text("number").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    // data da competência (o dia só importa quando a nota informa; para agrupar vale mês/ano)
    competence: date("competence", { mode: "string" }).notNull(),
    description: text("description"),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    content: bytea("content").notNull(),
    status: invoiceStatus("status").notNull().default("submitted"),
    reviewNote: text("review_note"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paidByUserId: uuid("paid_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // a mesma nota não é cadastrada duas vezes pelo mesmo colaborador
    uniqueIndex("invoices_collaborator_number_key").on(t.collaboratorId, t.number),
    index("invoices_company_idx").on(t.companyId, t.createdAt),
  ],
).enableRLS()

// Histórico das mudanças de status feitas pelo corporativo (quem, quando e por quê)
export const collaboratorStatusEvents = pgTable(
  "collaborator_status_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collaboratorId: uuid("collaborator_id")
      .notNull()
      .references(() => collaborators.id, { onDelete: "cascade" }),
    fromStatus: collaboratorStatus("from_status").notNull(),
    toStatus: collaboratorStatus("to_status").notNull(),
    reason: text("reason"),
    byUserId: uuid("by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("collaborator_status_events_collaborator_idx").on(t.collaboratorId, t.createdAt)],
).enableRLS()

// Lista de documentos que a empresa exige de todos os seus colaboradores
export const documentRequirements = pgTable(
  "document_requirements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    required: boolean("required").notNull().default(true),
    // remover da lista = arquivar; documentos já enviados continuam no histórico
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("document_requirements_company_idx").on(t.companyId)],
).enableRLS()

// Um arquivo vigente por colaborador e exigência; reenviar substitui o anterior.
export const collaboratorDocuments = pgTable(
  "collaborator_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collaboratorId: uuid("collaborator_id")
      .notNull()
      .references(() => collaborators.id, { onDelete: "cascade" }),
    requirementId: uuid("requirement_id")
      .notNull()
      .references(() => documentRequirements.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    // Arquivo no próprio Postgres (limite de 5 MB por upload). Nas listagens,
    // selecione colunas explicitamente para não trazer o conteúdo.
    content: bytea("content").notNull(),
    status: documentStatus("status").notNull().default("submitted"),
    reviewNote: text("review_note"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [uniqueIndex("collaborator_documents_unique_key").on(t.collaboratorId, t.requirementId)],
).enableRLS()

// Contrato da empresa com seus colaboradores PJ
export const contracts = pgTable(
  "contracts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // ex.: "Projeto de Tecnologia"
    description: text("description"),
    status: contractStatus("status").notNull().default("active"),
    startDate: date("start_date", { mode: "string" }).notNull(),
    // sem data de término = prazo indeterminado
    endDate: date("end_date", { mode: "string" }),
    // valor em centavos (BRL); nulo = não informado
    amountCents: bigint("amount_cents", { mode: "number" }),
    // prazo mensal de envio das notas fiscais: "até o dia N de cada mês" para todos os
    // colaboradores do contrato; nulo = sem prazo. Em meses mais curtos vale o último dia.
    invoiceDueDay: smallint("invoice_due_day"),
    responsibleUserId: uuid("responsible_user_id").references(() => users.id, { onDelete: "set null" }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("contracts_company_idx").on(t.companyId),
    uniqueIndex("contracts_company_name_key").on(t.companyId, sql`lower(${t.name})`),
    check("contracts_invoice_due_day_range", sql`${t.invoiceDueDay} between 1 and 31`),
  ],
).enableRLS()

// Colaboradores vinculados ao contrato
export const contractCollaborators = pgTable(
  "contract_collaborators",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    collaboratorId: uuid("collaborator_id")
      .notNull()
      .references(() => collaborators.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("contract_collaborators_key").on(t.contractId, t.collaboratorId),
    index("contract_collaborators_collaborator_idx").on(t.collaboratorId),
  ],
).enableRLS()

// Documentos exigidos só neste contrato (além dos exigidos de todos os colaboradores da empresa)
export const contractRequirements = pgTable(
  "contract_requirements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    required: boolean("required").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("contract_requirements_contract_idx").on(t.contractId)],
).enableRLS()

export type Company = typeof companies.$inferSelect
export type User = typeof users.$inferSelect
export type Membership = typeof memberships.$inferSelect
export type MembershipRole = (typeof membershipRole.enumValues)[number]
export type Invitation = typeof invitations.$inferSelect
export type Session = typeof sessions.$inferSelect
export type Collaborator = typeof collaborators.$inferSelect
export type CollaboratorStatus = (typeof collaboratorStatus.enumValues)[number]
export type DocumentRequirement = typeof documentRequirements.$inferSelect
export type Contract = typeof contracts.$inferSelect
export type Invoice = typeof invoices.$inferSelect
