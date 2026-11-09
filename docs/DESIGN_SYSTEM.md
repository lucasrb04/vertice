# Design System — Identidade Ipê

Identidade visual do Vértice desde a etapa 4 do plano de UI/UX (D51). Substitui a estética "Editorial Acadêmica"
(D25–D27). Spec: [`superpowers/specs/2026-11-09-identidade-ipe-design.md`](superpowers/specs/2026-11-09-identidade-ipe-design.md);
mockup de referência: [`superpowers/specs/assets/2026-11-09-processos-mockup.html`](superpowers/specs/assets/2026-11-09-processos-mockup.html).

A referência do autor foi a listagem do Welcome to the Jungle: conceito e sensação (filtros laterais, cards largos,
pílulas, creme quente com amarelo forte), nunca a marca, a fonte ou o amarelo deles.

## 1. Princípios

- **Acolhedor e prático:** fundo creme, cards brancos macios, um amarelo que convida; o que decide uma candidatura
  (prazo, bolsa, horas, requisitos) aparece em etiquetas escaneáveis.
- **Cor com função:** amarelo para a ação principal e o estado ativo; rosa para "filtrando" e "abre em"; verde para
  bolsa e sucesso; laranja para prazo curto; vermelho para erro e ação destrutiva; uma cor por categoria de projeto.
- **Amarelo nunca é texto.** Texto sobre amarelo é sempre `ink`. Links são `ink` sublinhados.
- **Uma casca só:** toda página parte de `max-w-[1320px]` com 16/24px de margem (`<Shell>`).
- **Sem fonte mono na interface:** números usam `tabular-nums`.

## 2. Cores (`src/app/globals.css`)

| Token (Tailwind) | Valor | Uso |
| --- | --- | --- |
| `ground` | `#f5f2ec` | fundo de todas as páginas |
| `surface` | `#ffffff` | cards, painéis, cabeçalho, campos |
| `surface-2` | `#faf8f4` | grupos dentro de painéis, colunas do Kanban, blocos de dados |
| `fact` | `#f6f3ee` | fundo das etiquetas de fato e selos neutros |
| `ink` | `#1f1b16` | texto principal, botão escuro, foco, links, caixas marcadas |
| `ink-2` | `#5a5348` | texto secundário |
| `ink-3` | `#6f675b` | metadados (4,99:1 sobre `ground`, 5,57:1 sobre branco) |
| `line` / `line-strong` | `#e6e0d4` / `#cfc7b8` | bordas / hover de bordas |
| `ipe` / `ipe-hover` | `#f4bf3a` / `#eab12a` | botão principal, pílula e aba ativas, marca |
| `ipe-soft` | `#fcf0cc` | dica para quem publica, realce da busca (`<mark>`), seleção de texto |
| `rosa-soft` / `rosa-ink` | `#f7dde6` / `#6b2340` | "Filtrando por", "Inscrições abrem em", avatar sem foto |
| `money-soft` / `money-ink` | `#e7f3e5` / `#1e5a33` | etiqueta de bolsa, "Candidatura enviada", status ativo |
| `urgent-soft` / `urgent-ink` | `#fff0e0` / `#a24b00` | prazo em até 3 dias |
| `danger-soft` / `danger-ink` | `#fdecea` / `#b42318` | erros, alertas e botão destrutivo |

Todos os pares de texto passam AA (≥ 4,5:1). A escala `stone-*` do Tailwind está remapeada para esses neutros
quentes e `brand` aponta para `ink`, para código antigo não voltar ao cinza frio; código novo usa os tokens acima.

**Cor por categoria** (`CATEGORY_COLORS` em `src/components/vitrine/project-tile.tsx`):

| Categoria | Fundo | Tinta |
| --- | --- | --- |
| Iniciação científica | `#dde8fb` | `#1d3f8f` |
| Extensão | `#dcefdf` | `#1e5a33` |
| Projeto especial | `#fde3cf` | `#8a3a05` |
| PET | `#ebe1fa` | `#4f2a8f` |
| Empresa júnior | `#d6f0ee` | `#0f5b56` |
| Laboratório | `#fbdfe3` | `#8c2236` |
| Outro | `#eee9df` | `#5a5348` |

## 3. Tipografia

- **Bricolage Grotesque** (`font-heading`, 500–800) em `h1`–`h4`, com `letter-spacing: -0.015em`. A marca usa 800 e
  −0,03em.
- **Figtree** (`font-sans`, 400–700) no resto; corpo 16px, nunca abaixo de 14px.
- Escala usada: título de página `text-[1.75rem] font-extrabold`; título de processo/projeto `1.6rem → 2.1rem`;
  título de card `1.14rem → 1.32rem font-bold`; título de seção `1.2rem font-bold`.
- Carregadas por `next/font/google` em `src/app/layout.tsx` (auto-hospedadas).

## 4. Forma e profundidade

- Raios: cards/painéis `rounded-2xl` (16px); cabeçalho 20px; botões 11px; campos 10px; etiquetas 9px; habilidades
  e tags em pílula.
- Sombra `shadow-card` (`0 1px 2px` + `0 4px 14px`, marrom a 5%) em cards brancos sem borda; `shadow-card-hover` no
  hover (com borda `line-strong`) e em diálogos. Nada de sombra dura.
- Foco: contorno de 3px `ink` com afastamento de 2px em todo elemento interativo (global em `:focus-visible`).
- Movimento: entrada dos cards (`animate-card-in`, 280ms, ease-out exponencial) e a folha de filtros do celular;
  ambos desligados com `prefers-reduced-motion`.

## 5. Componentes

- **Marca** (`src/components/layout/brand.tsx`): quadrado amarelo com "V" e ponto no vértice + "vértice". O mesmo
  desenho é o favicon (`src/app/icon.svg`).
- **Cabeçalho**: barra branca arredondada sobre o fundo; pílulas `NavPill` com `aria-current="page"` (amarela quando
  ativa). Abaixo de 1100px as pílulas da conta vão para o menu do avatar; abaixo de 640px, só marca e conta.
- **Botões** (`src/components/ui/button.tsx`): `default` (amarelo), `outline` (branco com borda), `ink` (escuro),
  `secondary`, `ghost`, `destructive` (`danger-soft` com borda), `link`. Alturas 40/36/44px.
- **Campos**: 44px, texto 16px, borda `line`, foco com borda `ink`.
- **Quadrado do projeto** (`ProjectTile`): sigla ou até três iniciais (sem preposições) na cor da categoria; `sm` 40px,
  `md` 48/60px, `lg` 64/72px. É decorativo: o nome do projeto sempre aparece ao lado.
- **Card de processo** (`OpportunityCard`): um por linha; título é o único link e cobre o card; etiquetas de fato com
  ícone Lucide 16px; habilidades em pílula; rodapé com prazo, forma de inscrição, "Publicado há…" e "Ver processo"
  (visual).
- **Painel de filtros** (`Filters` + `FilterSheet*`): coluna de 340px fixa ao rolar no desktop; abaixo de 1100px,
  folha modal que sobe de baixo (só com JavaScript, via `@custom-variant scripting`). "Filtrando por" em rosa só com
  algo ativo; grupos em `<details>` com contador amarelo.
- **Abas de situação** (`SituationTabs`): links com `aria-current`, contador em pílula escura na aba ativa.
- **Estados vazios** (`EmptyResults`): `none`, `tab` e `filtered`, sempre com uma ação.

## 6. Regras que não mudam

- Sem kicker (rótulo pequeno em caixa alta) acima de título; sem texto em gradiente; sem borda lateral colorida maior
  que 1px; sem sombra dura; sem emoji como ícone (só `lucide-react`).
- Nenhuma página com rolagem horizontal a 360px.
- Modo escuro segue fora do MVP (D28).
