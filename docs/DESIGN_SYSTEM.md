# Design System — Vértice

Este documento define a identidade visual, padrões de componentes, tipografia e diretrizes de design para o projeto **Vértice** (plataforma de vagas e projetos da UNIFEI). O objetivo principal é garantir que a aplicação fuja completamente dos clichês visuais de softwares gerados por inteligência artificial (evitando fundos escuros com gradientes neon roxo/azul, sombras pesadas e cards genéricos), adotando uma estética **Editorial Acadêmica / Moderna** (estilo Read.cv, Linear ou Are.na).

> Decisões visuais consolidadas em [`DECISIONS.md`](DECISIONS.md) (D25–D29).

## 1. Princípios Visuais Fundamentais

- **Clareza e Densidade Informacional:** O estudante universitário quer ver prazos, bolsas e requisitos de forma rápida. Menos firulas visuais, mais escaneabilidade.
- **Contraste Limpo e Neutro:** Paleta baseada em tons de cinza/stone frios e quentes, com acentos de cor funcionais e elegantes (azul institucional `#0F3D75`, esmeralda para match alto e âmbar para prazos próximos).
- **Bordas Delicadas e Linhas Limpas:** Uso extensivo de bordas finas (`1px solid border-border`) em vez de sombras pesadas (`drop-shadow` / `box-shadow`).
- **Tipografia com Personalidade:** Combinação de uma fonte sem-serifa geométrica/limpa para títulos com fontes monoespaçadas para dados técnicos (prazos, códigos, tags, porcentagens de match).

## 2. Paleta de Cores (Tokens CSS / Tailwind)

### Modo Claro (Padrão Principal)

| Elemento | Token / Valor |
| --- | --- |
| Background Geral | `stone-50` (`#fafaf9`) |
| Background de Superfícies / Cards | `white` (`#ffffff`) com borda `stone-200` (`#e7e5e4`) |
| Texto Primário (Headings) | `stone-900` (`#1c1917`) |
| Texto Secundário (Descrições) | `stone-600` (`#57534e`) |
| Cor de Destaque / Acento (Brand Primary) | Azul Institucional `#0F3D75` (token CSS `--brand`) |
| Badge de Match (Compatibilidade Alta ≥ 80%) | Fundo `emerald-50`, Texto `emerald-700`, Borda `emerald-200` |
| Badge de Vaga (IC / Extensão / Equipe) | Fundo `stone-100`, Texto `stone-700` |
| Prazo Encerrando (≤ 7 dias) | Âmbar `#D97706` (`amber-600`) |

### Modo Escuro (Fora do MVP)

Os tokens são definidos como variáveis CSS para permitir o modo escuro no futuro, mas ele **não será implementado no MVP**. Valores de referência:

| Elemento | Token / Valor |
| --- | --- |
| Background Geral | `stone-950` (`#0c0a09`) |
| Background de Superfícies / Cards | `stone-900` (`#1c1917`) com borda `stone-800` (`#292524`) |
| Texto Primário | `stone-100` (`#f5f5f4`) |
| Texto Secundário | `stone-400` (`#a8a29e`) |

## 3. Tipografia

- **Títulos e Headings:** **Plus Jakarta Sans** (`font-heading`), pesos 600/700, `tracking-tight` (`-0.02em`).
- **Corpo de Texto:** **Inter** (`font-sans`), pesos 400 para texto corrente e 500 para destaques inline.
- **Dados Técnicos, Badges, Prazos e % de Match:** **JetBrains Mono** (`font-mono`). Todas carregadas via `next/font`. Ex: `88% Match`, `Prazo: 14/11`, `12h/sem`.

## 4. Diretrizes de Componentes (Evitando o Padrão "IA Generativa")

### ❌ O que NÃO fazer (Clichês de IA)

- Fundos totalmente pretos com gradientes mesh em roxo, azul neon e rosa choque.
- Cards com sombras exageradas (`shadow-2xl` em tudo) e cantos arredondados excessivos (`rounded-3xl`).
- Ícones genéricos coloridos flutuando em caixas coloridas ao lado de cada título de seção.
- Efeitos de brilho (glow) em botões principais.

### ✅ O que FAZER (Padrão Vértice / Editorial)

- **Cards de Vagas na Timeline:** Fundo branco, borda sutil `stone-200`, hover com transição suave na borda (`hover:border-stone-400` e leve elevação `shadow-xs`).
- **Tags Abertas:** Badges compactas em formato pílula (`rounded-md` ou `rounded-full`), fundo `stone-100`, texto `stone-700`, tamanho de fonte `text-xs font-mono`.
- **Botões:**
  - **Primário:** Fundo escuro (`stone-900` com texto branco) ou azul institucional sólido, cantos moderados (`rounded-lg`). Hover com inversão ou escurecimento simples.
  - **Secundário:** Estilo Outline (borda `stone-300`, fundo transparente, texto `stone-800`).
- **Badges de Match:** Sempre destacadas no canto superior direito do card da vaga com fonte monoespaçada e ícone sutil de alvo/compatibilidade.

## 5. Estrutura Visual da Timeline de Vagas

### Filtros no Topo (Barra Horizontal / Sticky)

- Input de busca por palavra-chave com atalho de teclado simulado (`⌘K` ou `/`).
- Dropdowns limpos e minimalistas para Filtrar por Tipo (IC, Extensão, Competição) e Área de Interesse.

### Listagem de Cards

- Grid responsivo (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`) ou formato de lista limpa tipo feed do GitHub/Read.cv.
- Cada card exibe:
  - Nome do Projeto / Laboratório / Equipe (com selo discreto de verificação institucional).
  - Título da Vaga em destaque (`font-semibold text-stone-900`).
  - Tipo de fomento/bolsa (Bolsa FAPEMIG, Voluntário, etc.).
  - Tags técnicas resumidas (ex: Python, CAD, Gestão de Projetos).
  - Rodapé do card: Prazo restante (Encerra em 5 dias) + Botão de Ação ("Ver Detalhes / Inscrever-se").
