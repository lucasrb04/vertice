# Arquitetura Técnica e Engenharia de Sistema — Vértice (MVP UNIFEI)

Este documento define a arquitetura de software, modelagem de banco de dados, regras de segurança, algoritmos de busca/recomendação e topologia de infraestrutura na **Oracle Cloud Infrastructure (OCI)**. Ele foi desenhado para guiar a implementação assistida por agentes (**Claude Code + Superpowers**) seguindo os princípios de *Spec-Driven Development (SDD)*.

> Decisões consolidadas em [`DECISIONS.md`](DECISIONS.md), que prevalece em caso de conflito.

---

## 1. Princípios Arquiteturais

1. **Monólito Modular Enxuto:** Aplicação única em **Next.js (App Router)** utilizando *React Server Components (RSC)* para leitura de dados com latência próxima de zero e *Server Actions* tipadas para mutações, eliminando a sobrecarga operacional de manter um backend separado.
2. **Multi-Tenancy Invisível (Single-Tenant UI / Multi-Tenant DB):** Todas as entidades principais possuem `institutionId`. O frontend opera exclusivamente para a **UNIFEI — Campus Itajubá** no MVP, injetando o tenant automaticamente no backend via variável de ambiente (`DEFAULT_INSTITUTION_SLUG="unifei-itajuba"`).
3. **Segurança Defensiva por Padrão ("Zero Trust Student Environment"):** Todas as mutações passam por validação estrita de schema (Zod), verificação de sessão e autorização granular (RBAC Global + Membership de Projeto), proteção anti-bot (Cloudflare Turnstile), chaves não-sequenciais (UUIDv4) e sanitização rigorosa de URLs externas.
4. **Baixo Consumo de Recursos (OCI Friendly):** Build configurado com `output: "standalone"` no Next.js e banco PostgreSQL otimizado para rodar com folga em uma única VM Linux (ARM64 Ampere A1 ou AMD EPYC) na Oracle Cloud via Docker Compose.

---

## 2. Stack Tecnológica

| Camada | Tecnologia | Justificativa Técnica |
| :--- | :--- | :--- |
| **Framework Fullstack** | **Next.js (última estável, ≥ 15, App Router)** + **TypeScript 5** | SSR/RSC nativo para SEO da vitrine pública, Server Actions e tipagem ponta a ponta. |
| **Banco de Dados** | **PostgreSQL 16 (Alpine)** | Suporte robusto a extensões de busca textual (`pg_trgm`, `unaccent`), índices GIN e transações ACID. |
| **ORM & Migrations** | **Drizzle ORM** + `drizzle-kit` | Leve, SQL-like, zero overhead de binários Rust (ideal para containers Linux/ARM na OCI) e geração limpa de migrations. |
| **Autenticação** | **Better-Auth** (Adapter Drizzle) | Sessões no Postgres, login **somente via Google OAuth** restrito a `@unifei.edu.br` (D32) e campos customizados de usuário. |
| **Estilização & UI** | **Tailwind CSS v4** + **shadcn/ui** (Radix UI) | Componentes acessíveis e customizáveis para construir uma interface autoral (Editorial/Acadêmica) sem "cara de IA". |
| **Validação & Forms** | **Zod** + **React Hook Form** | Validação compartilhada entre cliente e servidor, bloqueando payloads malformados ou protocolos inseguros (`javascript:`). |
| **Testes** | **Vitest** + **Playwright** | Unidade (match, tags, URLs) e integração contra Postgres real de teste; E2E nos fluxos críticos. |
| **E-mails** | **Resend** + **React Email** | Templates transacionais em React/TSX com excelente entregabilidade para domínios `@unifei.edu.br`. |
| **Segurança & Anti-Bot** | **Cloudflare Turnstile** + **Rate Limiter** | Proteção invisível gratuita na criação de projetos e limitação de requisições por IP/Usuário. |
| **Infraestrutura & Proxy** | **Docker Compose** + **Caddy 2** | Orquestração simples de containers e provisionamento automático de certificados TLS/HTTPS (Let's Encrypt). |

---

## 3. Estrutura de Diretórios do Repositório

O código deve seguir uma organização modular por domínio (*Feature-Sliced Light*), facilitando o trabalho isolado de subagentes do Claude Code:

```text
vertice-unifei/
├── docs/
│   ├── PRD.md                    # Requisitos de produto e regras de negócio
│   ├── ARCHITECTURE.md           # Este documento técnico
│   ├── DESIGN_SYSTEM.md          # Guia estético, cores, tipografia e padrões de UI
│   ├── DECISIONS.md              # Registro de decisões (prevalece em conflitos)
│   ├── superpowers/specs/        # Specs de design (YYYY-MM-DD-tema-design.md)
│   └── plans/                    # Planos gerados pelo Superpowers (YYYY-MM-DD-feature.md)
├── CLAUDE.md                     # Instruções operacionais para o Claude Code
├── docker/
│   ├── Caddyfile                 # Configuração do Reverse Proxy e HTTPS
│   └── postgres/
│       └── init-extensions.sql   # Habilita pg_trgm, unaccent e uuid-ossp
├── drizzle/                      # Migrations SQL geradas pelo drizzle-kit
├── src/
│   ├── app/                      # Rotas do Next.js App Router
│   │   ├── (public)/             # Rotas públicas: / (home), /processos, /processo/[slug] (+ /edital), /projeto/[slug]
│   │   ├── (auth)/               # Login ("Entrar com Google")
│   │   ├── (student)/            # Onboarding, Perfil Completo, Minhas Candidaturas
│   │   ├── (organizer)/          # Wizard de Criação (Projeto + Vaga), Painel do Projeto, Kanban
│   │   ├── admin/                # Portal do SYSTEM_ADMIN (Dashboard, Projetos, Merge de Tags, Audit)
│   │   └── api/                  # Webhooks/Rotas do Better-Auth e Cron de Alertas
│   ├── components/
│   │   ├── ui/                   # Primitivos do shadcn/ui customizados pelo Design System
│   │   ├── layout/               # Header, Footer, CommandBar, Navegação
│   │   ├── opportunities/        # OpportunityCard, MatchBadge, ExplainableMatchPopover, Filters
│   │   ├── projects/             # ProjectHeader, KanbanBoard, MemberManager
│   │   ├── vitrine/              # OpportunityCard, Carousel, Filters, SafeMarkdown, Schedule, Requirements
│   │   └── tags/                 # TagCombobox (Autocomplete + Criação de Tag Aberta)
│   ├── db/
│   │   ├── index.ts              # Instância de conexão do Drizzle (Pool pg)
│   │   ├── schema/               # Definição modular das tabelas (institutions, users, projects, etc.)
│   │   ├── seed.ts               # Seed inicial (UNIFEI Itajubá, Cursos, Institutos, Tags Base)
│   │   └── seed-demo.ts          # Dados fictícios "Demo" (pnpm db:seed:demo; recusa produção)
│   ├── lib/
│   │   ├── auth/                 # Configuração do Better-Auth + Guards (requireAuth, requireAdmin)
│   │   ├── matching/             # Motor matemático de Afinidade e Explainable Match (Puro + Testável)
│   │   ├── public/               # Consultas da vitrine, parser de URL, rótulos e telemetria (sem imports de next/*)
│   │   ├── search/               # Normalização de Tags
│   │   ├── security/             # Validador Turnstile, Rate Limiter, Sanitizador de URLs, AuditLogger
│   │   ├── email/                # Cliente Resend + Templates React Email
│   │   └── tenant.ts             # Helper getDefaultInstitution() com cache em memória
│   └── actions/                  # Server Actions separadas por domínio
│       ├── onboarding.actions.ts
│       ├── opportunity.actions.ts
│       ├── project.actions.ts
│       ├── application.actions.ts
│       ├── tag.actions.ts
│       └── admin.actions.ts
├── Dockerfile
├── docker-compose.yml
├── drizzle.config.ts
└── package.json
```

---

## 4. Modelagem do Banco de Dados (Drizzle ORM Schema)

Todas as tabelas utilizam chaves primárias `uuid` geradas com `defaultRandom()` (UUIDv4) para eliminar vulnerabilidades de enumeração sequencial (**IDOR**).

### 4.1. Extensões PostgreSQL Obrigatórias (`init-extensions.sql`)

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";
```

### 4.2. Schema Principal (`src/db/schema/index.ts`)

```typescript
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  date,
  pgEnum,
  uniqueIndex,
  index,
  jsonb,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ==========================================
// 1. ENUMS DO DOMÍNIO
// ==========================================

export const systemRoleEnum = pgEnum("system_role", ["USER", "SYSTEM_ADMIN"]);

export const projectCategoryEnum = pgEnum("project_category", [
  "SPECIAL_PROJECT",   // Equipes de Competição / Projetos Especiais (ex: Baja, Fórmula, Aero)
  "SCIENTIFIC_INIT",   // Iniciação Científica (PIBIC, FAPEMIG, CNPq, PIVIC)
  "EXTENSION",         // Projetos de Extensão (PROEX / CEX)
  "JUNIOR_ENTERPRISE", // Empresas Juniores
  "PET",               // Programa de Educação Tutorial
  "LAB_GROUP",         // Laboratórios e Grupos de Pesquisa/Estudo
  "OTHER",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "ACTIVE",
  "UNDER_REVIEW", // Atingiu o limite de denúncias; oculto até revisão do admin
  "SUSPENDED",
  "ARCHIVED",
]);

export const projectMemberRoleEnum = pgEnum("project_member_role", [
  "OWNER",    // Criador/Coordenador/Capitão (controle total do projeto)
  "ADMIN",    // Edita o projeto e gerencia processos (não gerencia membros)
  "REVIEWER", // Avalia candidatos e move cards no Kanban
]);

export const scholarshipTypeEnum = pgEnum("scholarship_type", [
  "PAID",      // Com bolsa remunerada (PIBIC, FAPEMIG, CNPq, Institucional)
  "VOLUNTARY", // Voluntário (PIVIC, Equipes, Extensão sem bolsa)
  "BOTH",      // Edital contempla vagas remuneradas e voluntárias
]);

export const opportunityStatusEnum = pgEnum("opportunity_status", [
  "OPEN",
  "PAUSED",
  "UNDER_REVIEW", // Atingiu o limite de denúncias; oculta até revisão do admin
  "CLOSED",
]);

export const careerGoalEnum = pgEnum("career_goal", [
  "ACADEMIC",   // Carreira acadêmica / Mestrado
  "INDUSTRY",   // Preparação prática para o mercado
  "IMPACT",     // Impacto social e extensão
  "LEADERSHIP", // Liderança e gestão
  "EXPLORING",  // Ainda explorando
]);

export const reportTargetEnum = pgEnum("report_target", ["PROJECT", "OPPORTUNITY"]);

export const applicationStatusEnum = pgEnum("application_status", [
  "APPLIED",   // 1. Inscrito
  "IN_REVIEW", // 2. Em Análise
  "INTERVIEW", // 3. Entrevista / Dinâmica
  "ACCEPTED",  // 4A. Aprovado
  "REJECTED",  // 4B. Recusado
]);

export const tagCategoryEnum = pgEnum("tag_category", [
  "AREA",  // Grandes áreas/temas (ex: Inteligência Artificial, Aeroespacial, Gestão)
  "SKILL", // Ferramentas e competências (ex: Python, SolidWorks, Eletrônica, Marketing)
  "TOPIC", // Tags livres/abertas criadas pelos projetos
]);

export const studentTagRelationEnum = pgEnum("student_tag_relation", [
  "INTEREST",      // Área de interesse geral
  "KNOWN_SKILL",   // O que já tem contato/sabe
  "WANT_TO_LEARN", // O que deseja desenvolver no projeto
]);

export const opportunityTagRelationEnum = pgEnum("opportunity_tag_relation", [
  "THEME",           // Tema central do projeto/vaga
  "DESIRED_SKILL",   // Habilidade desejável (pré-requisito leve)
  "DEVELOPED_SKILL", // Habilidade que o aluno aprenderá na prática
]);

// ==========================================
// 2. MULTI-TENANCY & ESTRUTURA ACADÊMICA
// ==========================================

export const institutions = pgTable("institutions", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(), // "unifei-itajuba"
  name: varchar("name", { length: 160 }).notNull(),         // "UNIFEI - Campus Itajubá"
  shortName: varchar("short_name", { length: 32 }).notNull(), // "UNIFEI"
  allowedEmailDomains: jsonb("allowed_email_domains").$type<string[]>().notNull().default(["unifei.edu.br"]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 16 }).notNull(),      // Ex: "CCO", "ECO", "SIN", "EME"
    name: varchar("name", { length: 120 }).notNull(),     // Ex: "Ciência da Computação"
    institute: varchar("institute", { length: 32 }).notNull(), // Ex: "IESTI", "IMC", "IEPG"
  },
  (t) => [uniqueIndex("courses_inst_code_idx").on(t.institutionId, t.code)]
);

// ==========================================
// 3. USUÁRIOS & PERFIL DO ESTUDANTE
// ==========================================

// Tabela de usuário do Better-Auth (modelName "users" + additionalFields: institutionId,
// systemRole, isBanned). Só e-mails dos allowedEmailDomains da instituição se cadastram (D31).
// As tabelas sessions, accounts e verifications
// são geradas pelo CLI do Better-Auth e incluídas no schema Drizzle. Banir apaga as sessions.
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  systemRole: systemRoleEnum("system_role").notNull().default("USER"),
  isBanned: boolean("is_banned").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const studentProfiles = pgTable("student_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
  currentSemester: integer("current_semester"), // 1 a 12
  prefersPaidScholarship: boolean("prefers_paid_scholarship").notNull().default(false),
  preferredCategories: jsonb("preferred_categories").$type<string[]>().notNull().default([]),
  careerGoal: careerGoalEnum("career_goal"), // Não entra no score do MVP (D11)
  bio: text("bio"),
  githubUrl: varchar("github_url", { length: 255 }),
  linkedinUrl: varchar("linkedin_url", { length: 255 }),
  lattesUrl: varchar("lattes_url", { length: 255 }),
  portfolioUrl: varchar("portfolio_url", { length: 255 }),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  profileCompletionScore: integer("profile_completion_score").notNull().default(0), // 0 a 100
  emailAlertsEnabled: boolean("email_alerts_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// 4. SISTEMA DE TAGS ABERTAS E NORMALIZADAS
// ==========================================

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 64 }).notNull(),             // Nome de exibição: "Python", "Visão Computacional"
    normalizedSlug: varchar("normalized_slug", { length: 64 }).notNull(), // "python", "visao-computacional"
    category: tagCategoryEnum("category").notNull().default("TOPIC"),
    isVerified: boolean("is_verified").notNull().default(false), // Tags oficiais do seed ou aprovadas pelo Admin
    usageCount: integer("usage_count").notNull().default(0),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("tags_inst_slug_idx").on(t.institutionId, t.normalizedSlug),
    index("tags_name_idx").on(t.name),
  ]
);

// Armazena sinônimos/erros de digitação mesclados pelo Admin (ex: "pyhton" -> tagId de "python")
export const tagAliases = pgTable(
  "tag_aliases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    aliasSlug: varchar("alias_slug", { length: 64 }).notNull(),
    canonicalTagId: uuid("canonical_tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("tag_aliases_inst_slug_idx").on(t.institutionId, t.aliasSlug)]
);

export const studentTags = pgTable(
  "student_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    relationType: studentTagRelationEnum("relation_type").notNull(),
    proficiencyLevel: integer("proficiency_level").notNull().default(1), // 1: Iniciante, 2: Intermediário, 3: Avançado
  },
  (t) => [uniqueIndex("student_tags_unique_idx").on(t.userId, t.tagId, t.relationType)]
);

// ==========================================
// 5. PROJETOS E MEMBROS (ORGANIZADORES)
// ==========================================

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 100 }).notNull(),
    name: varchar("name", { length: 140 }).notNull(),
    acronym: varchar("acronym", { length: 20 }), // Sigla opcional (ex: "BAJA")
    shortDescription: varchar("short_description", { length: 280 }).notNull(),
    description: text("description"),
    category: projectCategoryEnum("category").notNull(),
    institute: varchar("institute", { length: 32 }), // Ex: "IESTI", "IMC", "IEPG"
    advisorName: varchar("advisor_name", { length: 120 }), // Professor Orientador / Coordenador
    websiteUrl: varchar("website_url", { length: 255 }),
    instagramUrl: varchar("instagram_url", { length: 255 }),
    contactEmail: varchar("contact_email", { length: 255 }).notNull(),
    hasInstitutionalBadge: boolean("has_institutional_badge").notNull().default(false), // "Projeto verificado" — concedido manualmente pelo admin (D31)
    status: projectStatusEnum("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("projects_inst_slug_idx").on(t.institutionId, t.slug)]
);

export const projectMembers = pgTable(
  "project_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: projectMemberRoleEnum("role").notNull().default("OWNER"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("project_members_unique_idx").on(t.projectId, t.userId)]
);

// ==========================================
// 6. VAGAS (OPPORTUNITIES) & CANDIDATURAS
// ==========================================

export const opportunities = pgTable(
  "opportunities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 140 }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description").notNull(),
    roleArea: varchar("role_area", { length: 80 }), // Ex: "Subsistema de Telemetria", "Pesquisa em Visão Computacional"
    internalSelectionEnabled: boolean("internal_selection_enabled").notNull().default(false), // Seleção pela plataforma (D34)
    externalUrl: varchar("external_url", { length: 500 }), // Opcional; https validado no Zod — D34
    customQuestion: varchar("custom_question", { length: 280 }), // Pergunta rápida p/ seleção pela plataforma
    scholarshipType: scholarshipTypeEnum("scholarship_type").notNull().default("VOLUNTARY"),
    fundingAgency: varchar("funding_agency", { length: 64 }), // Ex: "FAPEMIG", "CNPq", "PIBIC", "Sem Fomento"
    scholarshipValueCents: integer("scholarship_value_cents"), // Ex: 70000 (R$ 700,00)
    weeklyHours: integer("weekly_hours"), // Informativo (ex: 12h, 20h)
    vacanciesCount: integer("vacancies_count").default(1),
    targetCourseIds: jsonb("target_course_ids").$type<string[]>().notNull().default([]), // Vazio = Todos os cursos
    minSemester: integer("min_semester"),
    maxSemester: integer("max_semester"),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }).notNull(), // 23:59:59 de Brasília do dia informado
    applicationsOpenOn: date("applications_open_on", { mode: "string" }), // Cronograma (D35): YYYY-MM-DD
    interviewStartsOn: date("interview_starts_on", { mode: "string" }),
    interviewEndsOn: date("interview_ends_on", { mode: "string" }),
    resultOn: date("result_on", { mode: "string" }),
    activitiesStartOn: date("activities_start_on", { mode: "string" }),
    availabilityRequirement: varchar("availability_requirement", { length: 200 }),
    noOtherScholarship: boolean("no_other_scholarship").notNull().default(false),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    status: opportunityStatusEnum("status").notNull().default("OPEN"),
    viewsCount: integer("views_count").notNull().default(0),
    externalClicksCount: integer("external_clicks_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("opportunities_inst_slug_idx").on(t.institutionId, t.slug),
    index("opportunities_status_deadline_idx").on(t.institutionId, t.status, t.deadlineAt),
    check("opportunities_has_channel", sql`${t.internalSelectionEnabled} OR ${t.externalUrl} IS NOT NULL`),
  ]
);

export const opportunityTags = pgTable(
  "opportunity_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    relationType: opportunityTagRelationEnum("relation_type").notNull(),
  },
  (t) => [uniqueIndex("opp_tags_unique_idx").on(t.opportunityId, t.tagId, t.relationType)]
);

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: applicationStatusEnum("status").notNull().default("APPLIED"),
    answerText: text("answer_text"),
    externalProfileLink: varchar("external_profile_link", { length: 255 }),
    matchScoreSnapshot: integer("match_score_snapshot").notNull(), // Score 0-100 no momento da inscrição
    organizerFeedback: text("organizer_feedback"), // Mensagem enviada por e-mail ao mudar status
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("applications_opp_user_idx").on(t.opportunityId, t.userId)]
);

// Histórico de movimentações no Kanban (com a mensagem enviada por e-mail ao aluno)
export const applicationEvents = pgTable(
  "application_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    fromStatus: applicationStatusEnum("from_status"), // null no evento de criação
    toStatus: applicationStatusEnum("to_status").notNull(),
    message: text("message"),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("application_events_app_idx").on(t.applicationId, t.createdAt)]
);

// Botão "Já me inscrevi neste edital" (vagas EXTERNAL) — aparece em "Minhas Candidaturas"
export const externalApplicationMarks = pgTable(
  "external_application_marks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("ext_marks_user_opp_idx").on(t.userId, t.opportunityId)]
);

// Deduplicação de cliques no edital externo. visitorHash = HMAC(segredo, IP + User-Agent);
// o IP bruto nunca é armazenado (LGPD). externalClicksCount só incrementa em inserção nova.
export const opportunityExternalClicks = pgTable(
  "opportunity_external_clicks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    visitorHash: varchar("visitor_hash", { length: 64 }).notNull(),
    day: date("day").notNull(),
  },
  (t) => [uniqueIndex("ext_clicks_unique_idx").on(t.opportunityId, t.visitorHash, t.day)]
);

// Denúncias da comunidade. 5 denúncias distintas -> alvo vai para UNDER_REVIEW + e-mail ao admin
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    targetType: reportTargetEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    reporterUserId: uuid("reporter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: varchar("reason", { length: 500 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("reports_unique_idx").on(t.reporterUserId, t.targetType, t.targetId)]
);

// ==========================================
// 7. AUDITORIA E PORTAL DE ADMINISTRAÇÃO
// ==========================================

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 64 }).notNull(), // Ex: "PROJECT_CREATED", "ADMIN_TAG_MERGED", "PROJECT_SUSPENDED"
    targetType: varchar("target_type", { length: 32 }).notNull(), // "PROJECT" | "OPPORTUNITY" | "TAG" | "USER"
    targetId: uuid("target_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    ipAddress: varchar("ip_address", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("audit_logs_created_idx").on(t.institutionId, t.createdAt)]
);
```

---

## 5. Especificação Técnica do Motor de Recomendação (`src/lib/matching/engine.ts`)

O cálculo de afinidade é uma **função pura, determinística e isenta de I/O** (facilitando testes unitários com Vitest e explicação na monografia do TCC).

### 5.1. Modelo Matemático Implementado

Dado um estudante $u$ e uma vaga $v$, o score final $A(u, v) \in [0, 100]$ é definido por:

$$A(u, v) = \text{round}\left( \Phi_{\text{eleg}}(u, v) \cdot \left( 0.35 \cdot S_{\text{tema}}(u, v) + 0.45 \cdot S_{\text{hab}}(u, v) + 0.20 \cdot S_{\text{ctx}}(u, v) \right) \times 100 \right)$$

Onde cada componente varia no intervalo $[0, 1]$:

1. **Similaridade Temática ($S_{\text{tema}}$ — Peso $35\%$):**
   * Seja $I_u$ o conjunto de tags do aluno (`INTEREST` $\cup$ `KNOWN_SKILL` $\cup$ `WANT_TO_LEARN`) e $T_v$ o conjunto de tags `THEME` da vaga.
   * Calculado pela **Taxa de Cobertura da Vaga com Suavização de Jaccard**:
     $$S_{\text{tema}}(u, v) = 0.7 \cdot \frac{|I_u \cap T_v|}{\max(|T_v|, 1)} + 0.3 \cdot \frac{|I_u \cap T_v|}{\max(|I_u \cup T_v|, 1)}$$
     *(Prioriza cobrir os temas exigidos pela vaga sem penalizar o aluno que possui um perfil amplo com vários interesses).*

2. **Sinergia de Competências ($S_{\text{hab}}$ — Peso $45\%$):**
   * Subdividida em **Fit de Aprendizado ($S_{\text{learn}}$, peso $25\%$ do total)** e **Fit Técnico ($S_{\text{tech}}$, peso $20\%$ do total)**:
   * $S_{\text{learn}}$: cruza `WANT_TO_LEARN` ($L_u$) do aluno com `DEVELOPED_SKILL` ($D_v$) da vaga:
     $$S_{\text{learn}}(u, v) = \frac{|L_u \cap D_v|}{\max(|D_v|, 1)}$$
   * $S_{\text{tech}}$: cruza `KNOWN_SKILL` ($K_u$) do aluno com `DESIRED_SKILL` ($R_v$) da vaga, ponderado pelo multiplicador de proficiência $\rho(t) \in \{0.7, 0.9, 1.0\}$ (Iniciante, Intermediário, Avançado; sem proficiência preenchida $\Rightarrow 0.7$):
     $$S_{\text{tech}}(u, v) = \frac{\sum_{t \in K_u \cap R_v} \rho(t)}{\max(|R_v|, 1)}$$
   * Caso a vaga não defina `DESIRED_SKILL` ($|R_v| = 0$), todo o peso de $45\%$ é atribuído a $S_{\text{learn}}$.

3. **Alinhamento de Contexto e Modalidade ($S_{\text{ctx}}$ — Peso $20\%$):**
   * Média ponderada entre:
     * **Categoria do Projeto ($50\%$):** $1.0$ se a categoria do projeto (`SPECIAL_PROJECT`, `SCIENTIFIC_INIT`, etc.) está nas categorias preferidas do aluno; $0.5$ caso contrário.
     * **Bolsa ($50\%$):** Se `prefersPaidScholarship == true` e a vaga é exclusivamente `VOLUNTARY`, atribui $0.25$ (penaliza levemente mas não oculta a vaga); caso contrário, $1.0$.

4. **Fator de Elegibilidade ($\Phi_{\text{eleg}}$):**
   * Se `targetCourseIds` da vaga estiver vazio ou contiver `u.courseId`, $\Phi_{\text{eleg}} = 1.0$.
   * Se a vaga restringir a cursos específicos e o curso do aluno não estiver na lista, $\Phi_{\text{eleg}} = 0.45$ (sinalizando restrição de edital).

### 5.2. Geração de Justificativas (*Explainable Match*)

A função `calculateOpportunityMatch(student, opportunity)` retorna um objeto estruturado para a UI:

```typescript
export interface MatchResult {
  score: number; // 0 a 100
  tier: "HIGH" | "MEDIUM" | "LOW"; // HIGH >= 80, MEDIUM >= 50, LOW < 50
  reasons: {
    type: "POSITIVE" | "WARNING";
    text: string;
  }[];
}
```

Exemplos gerados automaticamente:
* `POSITIVE`: *"Desenvolve **Visão Computacional** e **Python**, que você quer aprender."*
* `POSITIVE`: *"Combina com seu conhecimento prévio em **Eletrônica**."*
* `WARNING`: *"Vaga voluntária (você indicou preferência por bolsas remuneradas)."*

---

## 6. Motor de Busca Híbrida e Sistema de Tags Abertas

### 6.1. Pipeline de Normalização de Tags (`src/lib/search/tags.ts`)
Para permitir que projetos criem novas tags livremente sem fragmentar o banco de dados:
1. Todo input de tag passa por `normalizeTagSlug(input)`:
   * Remove acentos (`NFD` + regex `/[\u0300-\u036f]/g`), converte para minúsculas, remove caracteres especiais (mantendo apenas `[a-z0-9+#.-]`) e substitui espaços por hífen.
   * Exemplo: `"Visão Computacional "` $\rightarrow$ `"visao-computacional"`; `"C++"` $\rightarrow$ `"c++"`.
2. **Resolução de Aliases:** Antes de criar uma nova tag no banco, a *Server Action* verifica se `normalizedSlug` existe em `tags` **ou** na tabela `tag_aliases`.
   * Se o Admin já tiver mesclado `"reactjs"` em `"react"`, e um novo projeto digitar `"ReactJS"`, o backend resolve silenciosamente para o `canonicalTagId` da tag `"React"`.

### 6.2. Fusão de Tags no Portal Admin (`mergeTagsAction`)
Quando o `SYSTEM_ADMIN` aciona a ferramenta de **Merge de Tags** (mesclando `sourceTagId` dentro de `targetTagId`):
1. Abre uma transação ACID no PostgreSQL (`db.transaction`).
2. Atualiza registros em `student_tags` e `opportunity_tags` que apontavam para `sourceTagId` para apontarem para `targetTagId` (usando `ON CONFLICT DO NOTHING` e removendo duplicatas residuais).
3. Insere o `normalizedSlug` da tag antiga na tabela `tag_aliases` apontando para `targetTagId`.
4. Recalcula o `usageCount` de `targetTagId`, remove `sourceTagId` e grava um registro em `audit_logs`.

### 6.3. Query de Busca na Timeline
`/processos` (`searchOpportunities` em `src/lib/public/queries.ts`; parâmetros validados por `parseVitrineParams`, inválidos são ignorados) combina:
* **Busca por Texto Livre (`q`, até 100 caracteres), D39:** cascata no PostgreSQL, sem motor externo. `planSearch` (`src/lib/search/query.ts`) monta o plano e `searchOpportunities` aplica:
  1. **Corretor por vocabulário** (`src/lib/search/corrector.ts`): palavra que já existe no vocabulário nunca é corrigida; as demais desfazem o diminutivo (`casinha` → `casa`) ou trocam pela palavra pública mais próxima por distância de edição (`fuzzystrmatch`, `pyhton` → `python`), com travas contra falsas correções. O vocabulário (`search_vocabulary`) vem só de processos públicos. `corrigir=0` desliga a etapa.
  2. **Sinônimos e aliases de tag** (`search_synonyms`, `tag_aliases`): cada palavra vira um grupo de variantes; basta casar uma.
  3. **FTS `portuguese` em duas formas** sobre `search_documents` (título, área, projeto, tags e descrição, com pesos), mais `LIKE` escapado para siglas e símbolos (`C++`) e para texto entre aspas, que é exato.
  4. **Ranqueamento em camadas:** frase exata no cabeçalho, todas as palavras no cabeçalho, todas no documento, demais; dentro delas, `ts_rank`. Uma quinta camada de palavra corrigida desempata. Abertos sempre antes de encerrados (D36).
  * **Índice:** `search_documents` é atualizado na mesma transação que grava o processo ou o projeto; o vocabulário é reconstruído em seguida e uma falha nisso não impede salvar. `pnpm db:search:rebuild` refaz tudo.
  * **Interface:** quando houve correção e há resultados, a vitrine mostra "Mostrando resultados para … · buscar exatamente …" (`role="status"`); o link repete a URL com `corrigir=0`, que paginação e filtros preservam e uma nova busca descarta.
* **Filtros Facetados (URL Search Params):**
  * `category`: Categoria do projeto (repetível: `SPECIAL_PROJECT`, `SCIENTIFIC_INIT`, `EXTENSION`, etc.)
  * `scholarship`: `PAID` | `VOLUNTARY` (`BOTH` entra nos dois)
  * `course`: Código do curso da UNIFEI (`CCO`, `ECO`, `EME`, etc.); processo sem cursos definidos sempre entra
  * `tags`: Lista de slugs de tags (`?tags=python,solidworks`), com semântica AND
  * `encerrados=1`: inclui encerrados, sempre depois dos abertos
  * `sort`: `relevance` (padrão com `q`), `recent` (padrão sem `q`), `deadline` (encerrando em breve) ou `popular` (`viewsCount + externalClicksCount`, D38).
  * `page`: 12 itens por página; fora do intervalo cai na página válida mais próxima.
* A consulta exibe apenas processos abertos de projetos `ACTIVE` (`openOpportunitySql`). Público (`publicOpportunitySql`) é `status <> 'UNDER_REVIEW'` em projeto `ACTIVE` ou `ARCHIVED`; fora disso, as páginas `/processo/[slug]` e `/projeto/[slug]` respondem 404.

---

## 7. Camada de Segurança e Blindagem ("Anti-Testes de TI")

Como a plataforma rodará na UNIFEI (onde há forte presença de alunos de Ciência/Engenharia da Computação e Sistemas de Informação), os seguintes controles são obrigatórios:

1. **Guards de Autorização Centralizados (`src/lib/auth/guards.ts`):**
   * `requireAuth()`: Verifica sessão ativa no Better-Auth e garante `user.isBanned === false`.
   * `requireProjectRole(projectId, ["OWNER", "ADMIN", "REVIEWER"])`: Consulta a tabela `project_members` garantindo que o usuário pertence ao projeto **e** ao mesmo `institutionId`. Caso o usuário seja `SYSTEM_ADMIN`, concede acesso de manutenção auditado.
   * `requireSystemAdmin()`: Protege todas as rotas `/admin/*` e `admin.actions.ts`. Qualquer tentativa de acesso por usuário não-admin retorna `404 Not Found` (para não revelar a superfície administrativa) e registra alerta no log.
2. **Sanitização Estrita de Links Externos (`src/lib/security/url.ts`):**
   * Campos como `externalUrl`, `websiteUrl`, `githubUrl`, `linkedinUrl` e `lattesUrl` utilizam um validador Zod customizado que faz `new URL(val)` e exige estritamente `parsed.protocol === "https:"`, bloqueando vetores XSS como `javascript:`, `data:` ou `vbscript:`.
3. **Proteção Anti-Spam e Rate Limiting:**
   * Validação server-side do token **Cloudflare Turnstile** na criação de projeto.
   * Rate Limiter em memória (`LRU Cache` no processo Node standalone) limitando mutações por IP e por `userId` (ex: máx. 3 projetos criados por usuário por dia, máx. 20 candidaturas por hora).
4. **Content Security Policy (CSP) e Headers HTTP (`next.config.ts`):**
   * `X-Frame-Options: DENY` (anti-clickjacking).
   * `X-Content-Type-Options: nosniff`.
   * `Referrer-Policy: strict-origin-when-cross-origin`.

---

## 8. Infraestrutura e Deploy na Oracle Cloud (OCI)

A aplicação será hospedada em uma única instância/pod na Oracle Cloud utilizando **Docker Compose** com **3 serviços leves**.

### 8.1. Topologia de Containers

```text
[ Internet (HTTPS / Porta 443) ]
               │
               ▼
┌─────────────────────────────────────────┐
│  Container 1: Caddy 2 (Reverse Proxy)   │ -> Gerencia SSL/TLS automático e compressão Zstd/Gzip
└──────────────────┬──────────────────────┘
                   │ (Rede interna Docker: app-network:3000)
                   ▼
┌─────────────────────────────────────────┐
│  Container 2: Next.js Standalone (App)  │ -> Node 22 Alpine (~120MB RAM em repouso)
└──────────────────┬──────────────────────┘
                   │ (Rede interna Docker: app-network:5432)
                   ▼
┌─────────────────────────────────────────┐
│  Container 3: PostgreSQL 16 Alpine      │ -> Volume persistente local + pg_trgm + unaccent
└─────────────────────────────────────────┘
```

### 8.2. `Dockerfile` (Next.js Standalone Multi-Stage)

```dockerfile
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### 8.3. `docker-compose.yml` (Pronto para a OCI)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: vertice-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-vertice}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-vertice_db}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./docker/postgres/init-extensions.sql:/docker-entrypoint-initdb.d/init-extensions.sql:ro
    networks:
      - vertice-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-vertice} -d ${POSTGRES_DB:-vertice_db}"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: vertice-app
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${POSTGRES_USER:-vertice}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-vertice_db}
      DEFAULT_INSTITUTION_SLUG: "unifei-itajuba"
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET}
      BETTER_AUTH_URL: ${NEXT_PUBLIC_APP_URL}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      VISITOR_HASH_SECRET: ${VISITOR_HASH_SECRET}
      NEXT_PUBLIC_APP_URL: ${NEXT_PUBLIC_APP_URL}
      RESEND_API_KEY: ${RESEND_API_KEY}
      EMAIL_FROM: ${EMAIL_FROM:-"Vértice UNIFEI <nao-responda@seudominio.com.br>"}
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: ${NEXT_PUBLIC_TURNSTILE_SITE_KEY}
      TURNSTILE_SECRET_KEY: ${TURNSTILE_SECRET_KEY}
      INITIAL_ADMIN_EMAIL: ${INITIAL_ADMIN_EMAIL}
    networks:
      - vertice-net

  caddy:
    image: caddy:2-alpine
    container_name: vertice-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    volumes:
      - ./docker/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - app
    networks:
      - vertice-net

networks:
  vertice-net:
    driver: bridge

volumes:
  pgdata:
  caddy_data:
  caddy_config:
```

### 8.4. Deploy da busca inteligente

Ordem: `pnpm db:migrate`, deploy da aplicação, `pnpm db:seed` (traz os sinônimos), `pnpm db:search:rebuild`. O último passo precisa rodar depois de qualquer deploy desta funcionalidade: não há backfill em SQL, e sem ele os processos existentes ficam fora do índice e do vocabulário. É idempotente e pode rodar com o site no ar.

---

## 9. Seed Inicial Obrigatório (`src/db/seed.ts`)

O comando `pnpm db:seed` deve ser idempotente (`onConflictDoNothing`) e popular:
1. **Instituição Padrão:** `slug: "unifei-itajuba"`, `name: "Universidade Federal de Itajubá — Campus Itajubá"`, `allowedEmailDomains: ["unifei.edu.br"]`.
2. **Cursos de Graduação da UNIFEI (Campus Itajubá):** *(o instituto de cada curso abaixo está impreciso e será revisado; não é crítico para o MVP)*
   * *IESTI:* Ciência da Computação (`CCO`), Engenharia de Computação (`ECO`), Sistemas de Informação (`SIN`), Engenharia Eletrônica (`EEL`), Engenharia de Controle e Automação (`ECA`), Engenharia Elétrica (`ELT`), Engenharia de Telecomunicações (`ETEL`).
   * *IMC:* Engenharia Mecânica (`EME`), Engenharia Mecânica Aeronáutica (`EMA`), Engenharia de Materiais (`EMAT`).
   * *IEPG:* Engenharia de Produção (`EPR`), Administração (`ADM`).
   * *IRN / IEI / IFQ / IMC:* Engenharia Ambiental (`EAM`), Engenharia Civil (`ECV`), Engenharia Hídrica (`EHD`), Engenharia Química (`EQA`), Engenharia de Bioprocessos (`EBP`), Engenharia de Energia (`EEN`), Física (`FIS`), Matemática (`MAT`), Química (`QUI`).
3. **Catálogo Inicial de Tags Verificadas (`isVerified = true`):**
   * *Áreas (`AREA`):* Inteligência Artificial, Ciência de Dados, Desenvolvimento Web, Sistemas Embarcados, Aeroespacial, Automobilística, Robótica, Energias Renováveis, Sustentabilidade, Gestão de Projetos, Finanças, Automação Industrial, Física Aplicada, Biotecnologia.
   * *Habilidades (`SKILL`):* Python, TypeScript, React, C/C++, ROS, SolidWorks, AutoCAD, MATLAB, ANSYS, PCB / Altium, Impressão 3D, Power BI, Marketing Digital, Gestão de Pessoas, Redação Científica, Inglês Técnico.
4. **Promoção Automática do Admin Inicial:** Caso a variável `INITIAL_ADMIN_EMAIL` esteja definida no `.env`, o usuário com esse e-mail recebe `systemRole = "SYSTEM_ADMIN"`.