# Entrada e painel — design

Etapa 3 do plano de UI/UX que saiu do critique do Impeccable (2026-11-08), achado **[P1] "Quem publica não tem por onde
entrar, e quem acabou de entrar cai no lugar errado"**. O autor pulou as perguntas do brainstorming; as escolhas abaixo
são do Claude e estão marcadas como tal quando não vieram do critique.

## Intenção

Os dois públicos pesam igual (`PRODUCT.md`). Hoje o visitante que quer publicar não vê por onde, o calouro que entra
cai num painel de "projetos" que não tem nada a ver com ele, o `/entrar` não diz para quê se está entrando e quem
publica nunca vê se o processo está sendo visto — para a maioria dos processos, a única conversão é o clique no edital.

## Escopo

1. **"Publicar processo" no cabeçalho, para todos.** Visitante vai para `/publicar`, que manda ao login com
   `next=/publicar` e volta à publicação depois de entrar (hoje o `next` se perde e cai no `/painel`: bug). No celular o
   texto encurta para "Publicar". O link de login do cabeçalho vira só **"Entrar"**, para o `/entrar` não ter "Entrar
   com Google" duas vezes.
2. **`/painel` com duas metades de mesmo peso**, lado a lado a partir de `md` e empilhadas no celular:
   - **Minhas candidaturas:** contagem em andamento, as 3 mais recentes (processo, projeto, etapa) e "Ver todas".
     Vazio: "Você ainda não se candidatou a nenhum processo." + **"Ver processos abertos"** (`/processos`).
   - **Meus projetos:** cada projeto com papel, status e, em linha mono, **processos abertos · candidatos em andamento
     · visualizações · cliques no edital**; botão "Publicar processo". Vazio: "Você ainda não participa de nenhum
     projeto." + texto curto para quem lidera equipe, laboratório ou projeto, e o link "Publicar processo".
   - Título "Olá, {nome}" mantido. Ordem: candidaturas primeiro (*escolha do Claude*: no celular, o público mais
     numeroso vê a sua metade sem rolar; as duas metades têm o mesmo tamanho e estilo).
3. **Números por processo no painel do projeto** (`/projetos/[id]`): cada processo mostra visualizações e cliques no
   edital (*escolha do Claude*, responde à pergunta 1 do critique; mesmo dado, sem consulta nova).
4. **`/entrar` com contexto**, a partir do `next` já validado por `safeNextPath`:
   - `/processo/{slug}/candidatar` → "Entre para se candidatar a **{título}**." (título só de processo público; slug
     inexistente ou oculto cai no texto padrão, sem revelar nada);
   - `/publicar` → "Entre para publicar o processo seletivo do seu projeto. Qualquer conta @unifei.edu.br publica,
     sem aprovação prévia.";
   - `/minhas-candidaturas` → "Entre para acompanhar suas candidaturas.";
   - `/projetos/…` → "Entre para gerenciar o seu projeto.";
   - qualquer outro → sem frase extra.
   Sempre: "Use sua conta Google @unifei.edu.br. O primeiro acesso cria a sua conta."
5. **Menu da conta:** "Meus projetos" vira **"Painel"** (o destino agora tem as duas metades).

## Fora do escopo

Redesenho visual (etapa 4), aviso de login antes de "Candidatar-se" e funil de etapas (etapa 5), contagens por período
(os contadores são acumulados desde a publicação e o texto diz só "visualizações" e "cliques no edital").

## Regras

- Contagens do projeto só para membros (a consulta parte de `project_members` do usuário). Somam todos os processos do
  projeto, inclusive encerrados e ocultos; "candidatos em andamento" = Inscrito, Em análise e Entrevista.
- Nenhum dado de candidato aparece no `/painel` além de números.
- `/entrar` nunca mostra texto vindo da URL: só o título lido do banco.

## Testes

- Unidade: frase de contexto do login por caminho.
- Integração: `listMyProjects` com contagens (zero sem processos; soma de vários; só candidaturas em andamento).
- E2E: cabeçalho de visitante → `/publicar` → `/entrar` com contexto e `next=/publicar`; `/painel` vazio com as duas
  metades e "Ver processos abertos"; `/painel` com candidatura e projeto com números; `/entrar` vindo de candidatar
  mostra o título.
