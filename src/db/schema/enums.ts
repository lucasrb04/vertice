import { pgEnum } from "drizzle-orm/pg-core";

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
