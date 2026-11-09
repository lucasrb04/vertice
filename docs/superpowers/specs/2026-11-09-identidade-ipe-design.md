# Identidade Ipê — design

Etapa 4 do plano de UI/UX que saiu do critique do Impeccable (2026-11-08): redesenho da identidade visual. Substitui
`docs/DESIGN_SYSTEM.md` e as decisões visuais D25–D27 (D28, modo escuro fora do MVP, continua valendo). Escolhas que
não vieram do autor estão marcadas como *escolha do Claude*.

## Intenção

O autor quer o Vértice "bonito, acolhedor, de fácil acesso, moderno, atual e prático"; hoje está "muito jogado, sem
identidade visual forte, sem personalidade". A referência escolhida por ele é a listagem de vagas do Welcome to the
Jungle (`docs/welcometothejungle.png`): painel de filtros à esquerda, cards largos um por linha com "logo", etiquetas
com ícone e ações no rodapé, botões em pílula com borda, fundo creme quente e um amarelo forte como destaque. O
mockup aprovado está em `docs/superpowers/specs/assets/2026-11-09-processos-mockup.html`.

**Não é um clone.** Do Welcome to the Jungle vêm o conceito e a sensação; logo, fonte própria, nome e o amarelo exato
deles ficam de fora. O Vértice tem marca, paleta e fontes próprias.

## Decisões do autor

1. **Paleta Ipê:** amarelo dos ipês de Itajubá como cor de destaque (escolhido entre Ipê, UNIFEI e Mantiqueira).
2. **A página inicial é a própria lista de processos**, como no Welcome to the Jungle. Sai a inicial com carrosséis e
   atalhos de categoria.
3. **Ao abrir, nada vem filtrado**: todos os processos abertos, do último publicado para o mais antigo. Filtros e busca
   só mudam a lista quando a pessoa mexe neles.
4. **Bloco "Filtrando por" só aparece com algo ativo**, com cada filtro removível e "Limpar tudo".
5. **Reestruturação total**: todas as páginas recebem a identidade, sem mockup individual ("o estilo já está claro").

## Mundo visual

### Cores (tokens em `globals.css`)

| Papel | Valor | Uso |
| --- | --- | --- |
| `ground` | `#f5f2ec` | fundo de todas as páginas (creme quente) |
| `surface` | `#ffffff` | cards, painéis, cabeçalho |
| `surface-2` | `#faf8f4` | grupos dentro de painéis (filtros, colunas do Kanban) |
| `ink` | `#1f1b16` | texto principal, botões escuros, foco, links |
| `ink-2` | `#5a5348` | texto secundário |
| `ink-3` | `#6f675b` | metadados (mín. 4,5:1 sobre `surface` e `ground`) |
| `line` / `line-strong` | `#e6e0d4` / `#cfc7b8` | bordas e hover de bordas |
| `ipe` / `ipe-hover` | `#f4bf3a` / `#eab12a` | destaque: botão principal, aba e nav ativas, marca. Texto sobre ele é sempre `ink` |
| `ipe-soft` | `#fcf0cc` | avisos (dica para quem publica), realce de busca |
| `rosa-soft` / `rosa-ink` | `#f7dde6` / `#6b2340` | bloco "Filtrando por", "Abre em…", avatar sem foto |
| `money-soft` / `money-ink` | `#e7f3e5` / `#1e5a33` | etiqueta de bolsa; sucesso |
| `urgent-soft` / `urgent-ink` | `#fff0e0` / `#a24b00` | prazo em até 3 dias |
| `danger-soft` / `danger-ink` | `#fdecea` / `#b42318` | erros e ações destrutivas (resolve o contraste baixo do botão destrutivo) |

Amarelo nunca é cor de texto nem de link (não passa contraste); links são `ink` sublinhados. A escala `stone-*` do
Tailwind é **remapeada** para os neutros quentes (`stone-50` → `ground`, `stone-200` → `line`, `stone-600` → `ink-2`,
`stone-900` → `ink` etc.) e `--color-brand` passa a ser `ink`, para que nada fique com o cinza frio antigo enquanto as
páginas migram (*escolha do Claude*). Código novo usa os tokens semânticos.

**Cor por categoria** (quadrado do projeto e pontinho no filtro): Iniciação científica azul `#dde8fb`/`#1d3f8f`,
Extensão verde `#dcefdf`/`#1e5a33`, Projeto especial laranja `#fde3cf`/`#8a3a05`, PET violeta `#ebe1fa`/`#4f2a8f`,
Empresa júnior verde-água `#d6f0ee`/`#0f5b56`, Laboratório rosa `#fbdfe3`/`#8c2236`, Outro neutro `#eee9df`/`#5a5348`.
É isto que faz os cards deixarem de parecer iguais.

### Tipografia

- Títulos: **Bricolage Grotesque** (700–800, `letter-spacing` −0,015em; marca −0,03em).
- Texto e interface: **Figtree** (400–700), corpo 16px; nunca abaixo de 14px.
- **Sem fonte mono na interface** (*escolha do Claude*, regra do craft floor: mono só para código). Números de dados
  usam `tabular-nums`. JetBrains Mono sai do layout.
- Via `next/font/google`, auto-hospedadas.

### Forma

- Raios: cards e painéis 16px, cabeçalho 20px, botões e campos 10–12px, etiquetas 9px, habilidades em pílula.
- Profundidade: cards brancos com sombra suave de duas camadas (`0 1px 2px` + `0 4px 14px`, tom marrom a 5%), sem
  borda; no hover, borda `line-strong` e sombra um pouco maior. Nada de sombra dura.
- Botões: altura 40–44px, peso 700. Variantes: **principal** (fundo `ipe`, texto `ink`), **contorno** (branco com
  borda `line`), **escuro** (`ink`, texto branco; ações finais como "Ver N processos"), **fantasma**, **destrutivo**
  (`danger-soft`/`danger-ink`, com borda) e **link**.
- Campos: altura 44px, raio 10px, borda `line`, foco com borda `ink`; texto 16px (evita zoom no iOS).
- Etiquetas de fato: fundo `#f6f3ee`, ícone Lucide de 16px + texto 15px.
- Foco visível: contorno de 3px `ink` com afastamento de 2px em tudo que é interativo.
- Seleção de texto em `ipe-soft`.
- Movimento: só a entrada suave dos cards ao trocar a lista e a folha de filtros subindo no celular; respeita
  `prefers-reduced-motion`.

### Marca

Quadrado amarelo arredondado com um "V" em traço `ink` e um ponto no vértice, ao lado de "vértice" em minúsculas
(Bricolage 800). Vira também o favicon (`src/app/icon.svg`). O nome "Vértice" segue em títulos de página e textos.

### Largura e grade

Uma só largura de casca para todas as páginas: `max-w-[1320px]` com 16px (celular) / 24px de margem. Dentro dela:
lista com painel de 340px + coluna fluida; páginas de leitura e formulários numa coluna de até ~760px; Kanban usa a
casca inteira, alinhado ao cabeçalho. Resolve as larguras que hoje variam de `max-w-3xl` a `max-w-7xl`.

## Casca (todas as páginas)

- **Cabeçalho**: barra branca arredondada flutuando sobre o fundo creme (não fixa). Esquerda: marca, pílula
  "Processos" (`/`, ativa em `/` e `/processo/*`) e pílula "Publicar processo". Direita: com sessão, pílulas "Minhas
  candidaturas" e "Painel" + avatar com o menu atual; sem sessão, pílula "Entrar". A pílula da página atual fica
  amarela com `aria-current="page"`.
  - Abaixo de 1100px as pílulas do meio somem e ficam no menu do avatar (que já tem Painel, Minhas candidaturas e
    Publicar processo). Sem sessão, "Publicar processo" continua visível até 640px e, abaixo disso, a dica da lista
    cumpre esse papel.
  - Nenhuma rolagem horizontal a 360px.
- **Rodapé**: sobre o fundo, marca pequena, a frase atual e o link da Política de Privacidade.

## Página inicial = lista de processos (`/`)

`/processos` deixa de ser uma página: redireciona permanentemente para `/` levando a query, para que links já
divulgados sigam funcionando. O limite de buscas por IP (`src/proxy.ts`) passa a valer em `/` (mesma regra: só
requisições com `q`), e o link da página de 429 aponta para `/`. Toda URL montada por `vitrineHref` passa a ser `/…`.

**Composição, de cima para baixo (desktop):**

1. **Painel de filtros** à esquerda (340px, fixo ao rolar quando couber na altura).
   - Cabeçalho "Filtros" e, só com algo ativo, o link "Limpar tudo".
   - **"Filtrando por"** (fundo `rosa-soft`), só com algo ativo: uma etiqueta por filtro ou busca, cada uma com "x"
     que é um link para a mesma lista sem aquele filtro (funciona sem JavaScript).
   - Grupos que abrem e fecham (`<details>`), com o número de opções marcadas ao lado do nome:
     - **Categoria** (aberto): caixas de seleção com o pontinho da cor da categoria e a contagem de processos que a
       lista teria com aquela categoria, considerando os outros filtros e a busca.
     - **Bolsa** (aberto): controle segmentado Qualquer / Com bolsa / Voluntário.
     - **Curso** (fechado, abre se ativo): seletor com os cursos agrupados por instituto (`<optgroup>`).
     - **Habilidades** (fechado, abre se ativo): as 12 tags mais usadas como pílulas marcáveis.
   - "Incluir encerrados" ao final.
2. **Coluna da lista**:
   - **Dica para quem publica** (fundo `ipe-soft`, ícone de megafone): "Lidera uma equipe, laboratório ou projeto?" +
     "Publique o processo seletivo em poucos minutos e receba o link pronto para divulgar. Qualquer conta
     @unifei.edu.br publica, sem aprovação prévia." + botão principal "Publicar processo". Fechável: o "x" grava um
     cookie e o servidor não a renderiza mais (sem piscar). *Escolha do Claude*: sem o botão "Como funciona" do
     mockup, porque essa página não existe.
   - **Busca** larga, com ícone, "x" para limpar e o atalho "/" de hoje.
   - **Abas** de situação com contador: **Abertos** · **Encerram em 7 dias** · **Abrem em breve** (novo parâmetro
     `situacao` = vazio | `encerrando` | `em-breve`). Os contadores respeitam filtros e busca. Com "Incluir
     encerrados", a primeira aba vira **Todos**. "Encerram em 7 dias" = aberto, já recebendo inscrições, prazo em até 7
     dias; "Abrem em breve" = inscrições começam depois de hoje. As abas são links (`vitrineHref` com `situacao`)
     com `aria-current`, não controles de formulário (*escolha do Claude*): funcionam sem JavaScript e preservam os
     demais parâmetros.
   - **Ordenar** à direita: Mais recentes (padrão sem busca), Relevância (padrão com busca), Prazo mais próximo, Mais
     procurados.
   - **Título da página** (h1, visível, modesto): "23 processos abertos" sem filtros; "4 processos encontrados" com
     filtros ou busca; seguido de "· mais recentes primeiro" (ou a ordem atual) em `ink-2`.
   - Aviso de correção de busca (existente), restilizado.
   - **Cards**, um por linha, e paginação (existente, restilizada).
3. **Celular (< 1100px)**: o painel some e vira o botão "Filtros" (com o número de filtros ativos) ao lado do
   ordenar; ele abre uma folha que sobe de baixo com o mesmo painel e o botão escuro "Ver N processos" (N = total
   atual), que fecha a folha. A folha é um diálogo modal acessível (foco dentro, Esc fecha, foco volta ao botão) e seus
   campos continuam pertencendo ao mesmo formulário GET. As abas rolam na horizontal dentro de si. Sem JavaScript, o painel aparece colapsado
   acima da lista, como hoje.

**Mecânica dos filtros**: continua sendo o formulário GET com `AutoSubmit` de hoje. Marcar qualquer coisa já atualiza a
lista e a URL, sem botão "Aplicar" (o botão segue existindo só sem JavaScript). Mantêm-se os comportamentos cobertos
pelos E2E atuais: foco preservado, painel aberto após mudar filtro, URL sem parâmetros vazios, uma só requisição por
página, histórico do navegador. *Escolha do Claude*: filtrar no navegador, como no mockup, quebraria links
compartilháveis e a busca no servidor.

### Card de processo

```
[sigla]  Título do processo (Bricolage 700, ~21px; link que cobre o card todo)
         Nome do projeto [selo verificado] · Categoria
         Resumo de uma ou duas linhas (texto puro da descrição, ~180 caracteres)
         [carteira Bolsa de R$ 700/mês · FAPEMIG] [relógio 12 h por semana] [capelo A partir do 3º período] [livro 4 cursos]
         (Python) (Visão computacional) (ROS)
         ─────────────────────────────────────────────────────────────
         [prazo]  [Inscrição pelo Vértice | Edital externo]  Publicado há 5 dias        [Ver processo →]
```

- **Quadrado do projeto** (60px; 48px no celular) na cor da categoria, com a sigla; sem sigla, as iniciais de até três
  palavras do nome, ignorando "de", "da", "do", "e" etc.
- Etiqueta de bolsa em verde (`money`) quando há bolsa (inclusive "bolsa ou voluntário"); "Voluntário" neutra com
  ícone de coração na mão.
- Cursos: "Todos os cursos", "1 curso" ou "N cursos". Período: o resumo de requisitos que já existe.
- Habilidades: até 4 tags; as que estão marcadas no filtro aparecem destacadas.
- **Prazo**: "Encerra em N dias · 12 nov", "Encerra amanhã", "Encerra hoje"; em até 3 dias fica `urgent`. "Inscrições
  abrem em 14 nov" em `rosa`. Encerrado: "Encerrado em …" neutro.
- **Forma de inscrição**: "Inscrição pelo Vértice" (seleção pela plataforma), "Edital externo" (só link) ou "Pelo
  Vértice ou pelo edital" (os dois).
- "Publicado hoje / ontem / há N dias / em 3 out" a partir da data de criação do processo.
- "Ver processo" é visual (o link é o título esticado); um só alvo de clique por card.
- Busca: os termos digitados aparecem realçados (`<mark>` em `ipe-soft`) no título, no projeto e no resumo.

**Dados novos no `PublicCard`**: `excerpt`, `publishedAt`, `maxSemester`, `internalSelectionEnabled`,
`hasExternalUrl`. As consultas novas são as contagens por aba e por categoria (mesmo `filtersSql`, mudando só a
dimensão contada) e o instituto dos cursos em `listFilterOptions`.

### Estados vazios

- Nenhum processo com os filtros ou a busca: "Nenhum processo com esses filtros" + "Tente tirar um filtro ou buscar
  por outra palavra." + botão escuro "Limpar filtros e busca".
- Nenhum processo aberto no sistema: "Nenhum processo aberto agora" + o texto atual + "Publicar processo".
- Aba vazia ("Abrem em breve" sem nenhum): "Nenhum processo abre inscrições nos próximos dias." + link "Ver todos os
  abertos".

**Sai**: `HomeRow`, `Carousel`, `listHomeRows` e os atalhos de categoria (os filtros cumprem esse papel); a frase de
abertura da inicial de hoje sai (o título com a contagem e a dica cumprem o papel).

## Demais páginas

Mesma casca, cores, tipos, botões e campos. **Muda a aparência, não o funcionamento**: rotas, textos de ação,
validações e fluxos ficam como estão, salvo onde dito.

- **Processo (`/processo/[slug]`)**: em `lg`, duas colunas. À esquerda, card branco com o cabeçalho (quadrado do
  projeto, título, projeto, categoria, etiquetas de fato), a descrição em Markdown, requisitos e cronograma. À direita,
  card de inscrição fixo ao rolar: prazo em destaque, a ação principal (Candidatar-se / Abrir edital) em amarelo, o
  aviso de login, a situação da candidatura quando houver e "Denunciar". No celular, o card de inscrição vem logo
  depois do cabeçalho.
- **Projeto (`/projeto/[slug]`)**: cabeçalho com o quadrado grande da categoria, nome, categoria, instituto,
  orientador e descrição; os processos do projeto como os mesmos cards da lista.
- **Entrar (`/entrar`)**: card branco centrado com a marca, a frase de contexto e o botão do Google.
- **Painel (`/painel`)**: as duas metades atuais como painéis brancos; projetos com o quadrado da categoria.
- **Minhas candidaturas**: um card por candidatura com o quadrado do projeto; no funil, a etapa atual em amarelo.
- **Candidatar, Publicar, editar projeto e processo, membros**: formulários em cards brancos de seções, campos novos.
- **Gestão do projeto (`/projetos/[id]`)**: cabeçalho com o quadrado e as abas da gestão em pílulas; Kanban com
  colunas `surface-2` e cards brancos, na largura da casca.
- **Admin, Privacidade, erro e 404**: mesma casca e componentes.
- **E-mails** (React Email): fora desta etapa.

## Documentação

- `docs/DESIGN_SYSTEM.md` reescrito a partir do que for construído (tokens, componentes, regras acima).
- `docs/DECISIONS.md`: nova **D51** "Identidade Ipê", que substitui D25–D27; D28 segue; D29 já fora substituída pela
  D38.
- `CLAUDE.md` e `PRODUCT.md`: trocar "Editorial Acadêmico" pela identidade Ipê e a rota da vitrine para `/`.

## Fora do escopo

Salvar processo, "Não é pra mim", página de listagem de projetos, perfil do aluno, match, modo escuro, e-mails.

## Testes

- **Unidade**: resumo em texto puro da descrição (Markdown removido, corte em palavra, reticências); iniciais do
  projeto; "Publicado há…"; rótulo da forma de inscrição; `parseVitrineParams` com `situacao`; `vitrineHref`
  gerando `/…` e preservando `situacao`; limite de busca em `/`.
- **Integração**: `searchOpportunities` com cada `situacao`; contagens por aba e por categoria respeitando filtros e
  busca; `listFilterOptions` com instituto; campos novos do card.
- **E2E**: `/processos?…` redireciona para `/?…`; inicial sem filtros em ordem de publicação; marcar filtro mostra
  "Filtrando por", remover pela etiqueta volta ao estado limpo; abas filtram e contam; folha de filtros no celular;
  fechar a dica persiste; os E2E atuais de `/processos` migrados para `/`; os da inicial com carrossel removidos; sem
  rolagem horizontal a 360px nas páginas principais.
