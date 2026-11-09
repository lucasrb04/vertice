# Product

<!-- impeccable:product-schema 1 -->

> Registro durável de produto para o trabalho de design. Detalhes de regras de negócio, schema e decisões ficam em
> `docs/PRD.md`, `docs/ARCHITECTURE.md` e `docs/DECISIONS.md` (este último prevalece em conflitos); aqui fica só o
> que orienta decisões de interface.

## Platform

web

## Users

Dois públicos com peso igual (confirmado pelo autor em 2026-11-08); nenhum prevalece por padrão, e cada decisão de
interface pesa os dois:

- **Aluno da UNIFEI (Campus Itajubá) que procura oportunidade.** Do calouro que ainda não sabe o que existe ao
  veterano que já sabe o que quer. Job: descobrir iniciações científicas, extensão, equipes de competição (projetos
  especiais), PETs, laboratórios e empresas juniores alinhados ao que sabe e ao que quer aprender; entender rápido
  prazo, bolsa e requisitos; inscrever-se; acompanhar o andamento.
- **Quem publica e seleciona.** Líderes de equipe, coordenadores e professores (muitas vezes também alunos). Job:
  divulgar um processo seletivo em poucos minutos, alcançar além da própria bolha e, se quiserem, conduzir a seleção
  pela plataforma em vez de planilhas improvisadas.
- **Administrador do sistema.** Modera conteúdo sob demanda, governa tags e acompanha auditoria em `/admin`.

A mesma pessoa pode ser candidata num projeto e recrutadora em outro (papel global `USER` + papéis por projeto
`OWNER`, `ADMIN`, `REVIEWER`).

## Product Purpose

Centralizar a divulgação e a seleção de oportunidades acadêmicas da UNIFEI, hoje espalhadas em e-mails pouco lidos,
stories de Instagram e indicação boca a boca. Sucesso, nos próximos meses: **uso real** (equipes, laboratórios e
professores publicando de verdade e alunos se candidatando), com a **defesa do TCC** como marco de prazo.

## Positioning

- Feito para a realidade da UNIFEI: cursos, institutos e modalidades locais (PIBIC, FAPEMIG, CNPq, projetos
  especiais, PET), não uma plataforma genérica de vagas.
- Baixíssima fricção e operação autônoma: qualquer conta `@unifei.edu.br` publica sem aprovação prévia; a moderação é
  reativa (denúncias e admin).
- Dois canais por processo, não excludentes: **link do edital oficial** (acessível sem login) e/ou **seleção pela
  plataforma** (candidatura + Kanban de 5 etapas com mensagens por e-mail). O projeto pode usar o Vértice só como
  vitrine ou também como ferramenta de seleção.
- Planejado, ainda não implementado: recomendação com percentual de compatibilidade e justificativa (*explainable
  match*) a partir do que o aluno sabe e do que quer aprender.

## Operating Context

- Login só com Google, restrito a `@unifei.edu.br`; o primeiro login cria a conta. Visitantes sem login navegam pela
  vitrine e abrem editais externos.
- Editais oficiais vivem fora (PDF, SIGAA, Google Forms); o Vértice aponta para eles e conta cliques.
- Comunicação com candidatos acontece por e-mail (mudança de status com mensagem do gestor); não há chat.
- Rotas principais hoje: lista de processos com busca e filtros em `/` (`/processos` redireciona para ela), processo `/processo/[slug]`, projeto `/projeto/[slug]`,
  login `/entrar`, painel do usuário `/painel` (meus projetos), `/minhas-candidaturas`, publicação `/publicar`,
  gestão do projeto `/projetos/[id]` (editar, membros, processos, candidatos/Kanban), `/admin`, `/privacidade`.
- Navegação da conta pelo menu do cabeçalho (foto/iniciais + nome).

## Capabilities and Constraints

**Existe hoje:** vitrine pública com busca textual, filtros e tags; páginas de processo e projeto; publicação de
projeto + primeiro processo num fluxo único; gestão de projeto, membros e processos; candidatura pela plataforma com
pergunta aberta; Kanban de 5 status com "Mover para" (sem arrastar, funciona com teclado e no celular, D45);
"Minhas candidaturas"; e-mails transacionais (Resend); denúncias e moderação; portal `/admin`; política de privacidade.

**Ainda não existe (prometido no PRD):** motor de match e percentual de compatibilidade (o snapshot fica nulo, D45);
onboarding em 3 passos; perfil profundo editável (curso, semestre, habilidades "já sei / quero aprender", bio,
links), embora os campos existam no banco; lembretes de prazo.

**Fora do MVP:** chat, upload de PDFs, testes ou vídeo-entrevistas, integração com o SIGAA, seletor de outras
universidades na interface.

**Restrições:** Next.js App Router + Tailwind v4 + shadcn/ui; textos em pt-BR; Markdown restrito nas descrições
(D21); só `https://` em links externos; dados de candidatos nunca aparecem em páginas públicas; limites anti-abuso
(3 projetos por usuário por dia, 20 candidaturas por hora, busca limitada por IP); instância única na OCI.

**Terminologia em uso na interface:** "processo" / "processo seletivo" (não "vaga"), "projeto", "candidatura",
"Seleção pela plataforma", "Edital".

## Brand Commitments

Nenhum compromisso obrigatório (confirmado pelo autor em 2026-11-08): até o nome pode mudar (o PRD ainda lista Nexo,
Órbita, Vetor e Pulso como alternativas a Vértice). Hoje o produto usa o nome **Vértice** e o domínio
`verticehub.online`. A identidade visual atual é a **Ipê** (D51, `docs/DESIGN_SYSTEM.md`), escolhida pelo autor em 2026-11-09 a partir da referência do Welcome to the Jungle; ela substitui a estética "Editorial Acadêmica" e é a
implementação atual, não um compromisso: um redesenho pode revê-la.

## Evidence on Hand

- Dados reais de referência: 21 cursos e 32 tags da UNIFEI no seed (`src/db/seed-data.ts`).
- Ainda não há usuários reais além do autor, nem depoimentos, métricas de uso, logos de parceiros ou casos. **Nada
  disso pode ser inventado** em telas, textos ou mockups.

## Product Principles

1. **Os dois lados do mercado importam igual:** uma melhoria para o aluno não pode custar fricção para quem publica, e
   vice-versa.
2. **Fricção mínima até o primeiro valor:** ver processos sem login, publicar em minutos, candidatar-se com poucos
   passos.
3. **O que decide uma candidatura vem primeiro:** prazo, bolsa, requisitos e como se inscrever, escaneáveis de
   relance.
4. **Honestidade sobre o que existe:** não sugerir match, números ou adoção que o sistema ainda não tem.
5. **Privacidade de candidatos por padrão** (LGPD): só o próprio aluno e os gestores do projeto veem uma candidatura.

## Accessibility & Inclusion

Nenhum padrão formal foi fixado. O que já é prática do projeto: navegação por teclado nos fluxos críticos (Kanban sem
arrastar, menus acessíveis), páginas que funcionam no celular e testes E2E que verificam a ausência de rolagem
horizontal.
