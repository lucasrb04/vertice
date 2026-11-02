# Spec — Subprojeto 2: Vitrine pública

- **Data:** 2026-11-02
- **Status:** Autorizada pelo autor sem rodada de perguntas ("pode seguir com o dev"); decisões do Claude listadas na §7 para revisão com a página rodando.
- **Referências:** [`DECISIONS.md`](../../DECISIONS.md) D21, D29, D34–D38; [`PRD.md`](../../PRD.md) RF01, RF05; [`DESIGN_SYSTEM.md`](../../DESIGN_SYSTEM.md).

## 1. Intenção

A maioria dos alunos só quer consultar, sem conta. Pedido do autor: logo no início, uma **barra de busca** com um texto rápido explicando o que a pessoa faz ali e um **slogan simples**; logo abaixo, **listas prontas em carrossel** ("últimos publicados", "mais procurados"). Quem busca chega à lista de processos com filtros e, dali, à página aberta do processo, com datas, requisitos e link do edital.

## 2. Objetivos

1. Home `/` com slogan, busca, atalhos por categoria e carrosséis.
2. `/processos`: busca textual tolerante a acentos e erros, filtros combináveis, ordenação e paginação, tudo sem login e funcionando sem JavaScript.
3. `/processo/[slug]`: página pública do processo.
4. `/projeto/[slug]`: página pública do projeto, com processos abertos em destaque e histórico abaixo (D36).
5. Clique no edital com contagem deduplicada; contagem de visualizações.
6. Markdown restrito (D21) renderizado com segurança.
7. Dados de demonstração para desenvolvimento e troca do locale do Zod para pt-BR.

## 3. Não-objetivos

Match e ordenação por compatibilidade, candidatura pela plataforma (filtro "Tipo de inscrição" fica oculto enquanto `INTERNAL_SELECTION_AVAILABLE` for `false`), "Já me inscrevi", denúncias, sitemap, índices de busca (volume pequeno no MVP).

## 4. Anti-objetivos

- Processo encerrado aparecer na home ou na frente de abertos em qualquer lista (D36).
- Carrossel com rolagem automática, ou que só funcione com mouse.
- Exigir login para consultar ou abrir o edital.
- Vazar processo em revisão, projeto suspenso ou dado de membros em rota pública.
- Link não-`https` renderizado ou redirecionado.
- Home com seções vazias ou aparência de "cara de IA" (gradientes, cards gigantes).

## 5. Design

### 5.1. Visibilidade

**Público** = processo com `status <> 'UNDER_REVIEW'` em projeto `ACTIVE` ou `ARCHIVED`. Fora disso, 404. **Aberto** segue `openOpportunitySql`; todo processo público não aberto é **encerrado**. Projeto público = `ACTIVE` ou `ARCHIVED`.

### 5.2. Home `/`

- `h1`: **"Encontre o projeto que vai impulsionar sua trajetória."**
- Apoio: **"Iniciação científica, extensão, equipes de competição, PETs e empresas juniores da UNIFEI em um só lugar, com prazos e requisitos. Sem precisar de conta."**
- Busca (form GET para `/processos`), placeholder **"Busque por projeto, área ou habilidade"**, botão **"Buscar"**; atalho `/` foca o campo.
- Atalhos por categoria (links para `/processos?category=…`) e contagem em `font-mono`: "`N` processos abertos" (só se N > 0).
- Carrosséis, nesta ordem, até 10 itens, com link "Ver todos": **Últimos publicados** (`sort=recent`), **Encerrando em breve** (`sort=deadline`), **Mais procurados** (`sort=popular`, só itens com popularidade > 0). Lista vazia não aparece; sem nenhum processo aberto, mostra um estado vazio com convite para publicar.
- Carrossel: rolagem nativa com CSS scroll-snap, botões anterior/próximo (desabilitados nas pontas), navegável por teclado, sem autoplay; sem JS continua rolável.

### 5.3. Card

Projeto (sigla ou nome) com selo discreto se verificado, categoria, título, bolsa, carga horária, até 4 tags, requisitos resumidos (cursos: "Todos os cursos" ou "N cursos"; "A partir do Nº período"), prazo: `Encerra em N dias` / `Encerra hoje` (âmbar se ≤ 7 dias) ou `Encerrado em dd/mm/aaaa`. O card inteiro é um link para o processo.

### 5.4. `/processos`

Params: `q` (até 100), `category` (repetível), `scholarship` (`PAID`|`VOLUNTARY`; `BOTH` entra nos dois), `course` (código; processo sem cursos definidos é aberto a todos e sempre entra), `tags` (slugs, separados por vírgula; AND), `encerrados=1`, `sort` (`relevance`, `recent`, `deadline`, `popular`), `page`. Inválidos são ignorados. Padrão: `relevance` com `q`, senão `recent`. Com `encerrados=1`, abertos sempre vêm antes. 12 itens por página, links de paginação. Título conta o total. Sem resultados: mensagem e link para limpar filtros. Filtros em `<details>` no celular; aplicam automaticamente com JS e por botão "Aplicar" sem JS.

**Busca:** normaliza com `lower(unaccent())`; casa por `ILIKE %q%` em título, área, nome/sigla do projeto, orientador, descrição e tags, ou, só quando o termo tem ao menos 4 letras, `word_similarity > 0.4` em título, nome do projeto e tags (termos curtos como `C++` ou `100%` casariam qualquer palavra com a mesma inicial). Ordena por maior similaridade.

**Popularidade** (D38): `views_count + external_clicks_count`.

### 5.5. `/processo/[slug]`

Título, projeto (link), categoria, selo; bloco de ação com prazo (`DEADLINE_LABEL`) e botão **"Acessar edital"** (`rel="nofollow noopener"`, nova aba) quando há link; descrição em Markdown; **Cronograma** (só datas preenchidas); **Requisitos** (cursos, período mínimo, disponibilidade, não acumular bolsa); bolsa, carga, vagas; tags em grupos. Encerrado: aviso "Processo encerrado", sem destaque de ação, com link para outros processos do projeto. Metadados de título e descrição.

### 5.6. `/projeto/[slug]`

Nome, sigla, categoria, instituto, orientador, selo, descrição Markdown, site, Instagram, e-mail de contato; "Processos abertos"; "Processos anteriores" (mais recentes primeiro). Arquivado: rótulo "Projeto arquivado". Não mostra membros. Painel privado ganha link "Ver página pública".

### 5.7. Telemetria

- `GET /processo/[slug]/edital`: revalida `https`, registra clique, responde 302. Sem link ou não público: 404.
- `visitorHash = HMAC-SHA256(VISITOR_HASH_SECRET, ip + "\n" + userAgent)`; IP bruto nunca é gravado. Dia em Brasília. `external_clicks_count` só incrementa em inserção nova, na mesma transação.
- Visualização: incrementa `views_count` após a resposta (`after`), no máximo uma vez por visitante/processo/dia (limiter em memória), nunca falha a página.
- `VISITOR_HASH_SECRET`: mínimo 32 caracteres, obrigatório em produção; fora dela, valor fixo de desenvolvimento.

### 5.8. Markdown

`react-markdown` sem HTML; elementos permitidos: `p, strong, em, ul, ol, li, a, br`; os demais perdem a tag e mantêm o texto. Link só `https:` (senão vira texto), `target="_blank" rel="nofollow noopener noreferrer"`.

### 5.9. Demo

`pnpm db:seed:demo`: idempotente, recusa `NODE_ENV=production`, cria projetos e processos fictícios (prefixo "Demo") em datas relativas a hoje, incluindo encerrado e verificado.

## 6. Critérios de aceite

1. `pnpm lint`, `pnpm tsc --noEmit`, `pnpm test`, `pnpm test:e2e`, `pnpm build` passam.
2. Visitante anônimo busca "robotica" e encontra "Robótica"; erro leve de digitação também encontra.
3. Encerrado nunca aparece na home nem sem `encerrados=1`.
4. Processo em revisão ou de projeto suspenso dá 404; arquivado abre como encerrado.
5. Clique repetido no mesmo dia conta uma vez; `javascript:` no Markdown não vira link.
6. Mensagens de validação em pt-BR ("Pequeno demais…").

## 7. Decisões do Claude (revisar com a página aberta)

Slogan e textos; "Encerrando em breve" como terceiro carrossel; rotas `/processos`, `/processo/[slug]`, `/projeto/[slug]` (`/projetos/[uuid]` é privada); popularidade sem janela de 30 dias; filtro "Tipo de inscrição" oculto; "A definir" fora do filtro de bolsa (não existe esse dado); paginação em vez de scroll infinito; visualização deduplicada em memória; seed de demonstração; processo `PAUSED` tratado como encerrado.

## 8. Temas em aberto (para tratar depois)

Registrados a pedido do autor em 2026-11-02 e atualizados no mesmo dia.

**Decididos, ainda por implementar**
- Criar conta: só para candidatura pela plataforma (D40).

**Falta o autor revisar**
- Textos da home, slogan e o carrossel "Encerrando em breve", que foram escolha do Claude.
- Institutos dos cursos em `src/db/seed-data.ts`, marcados com `TODO`.

**Melhorias adiadas**
- Filtros marcados ficam presos ao clicar em "Processos" no cabeçalho (`defaultChecked`), e o painel de filtros não acompanha a URL em navegação suave.
- A contagem da home inclui processos que ainda não abriram.
- Filtros: `::details-content` em navegadores antigos foi tratado, mas falta teste de filtros mantidos entre páginas, de filtro alterado na página 2 e do caminho sem JS no celular.
- Código de curso desconhecido na URL filtra em vez de ser ignorado.
- Normalização de acentos difere entre JS e SQL em letras fora do português (ß, Ø).
- Cliques podem ser inflados trocando `x-forwarded-for`; o Caddy precisa sobrescrever o cabeçalho no deploy.
- Teste de falha da telemetria pode não exercitar o `catch`; testes de "nenhum membro" não têm membro de verdade; falta E2E de processo em projeto arquivado.
- Rotas: nome acessível longo no card, `h2` e `waitForTimeout` no E2E da home, dois relógios no card.
- Herdado do Subprojeto 1: permissão lida fora da transação (corrida com arquivamento), sem retry de slug de processo, tags sem `orderBy` no formulário, `listCourses` com ordenação por bytes, `<details>` do formulário que fecha ao limpar erros, "Publicar" desabilitado sem aviso quando o token expira, mensagem de sessão para usuário banido.
- `pnpm add` falha com `ERR_PNPM_UNEXPECTED_STORE` até reinstalar o `node_modules` no store padrão.

