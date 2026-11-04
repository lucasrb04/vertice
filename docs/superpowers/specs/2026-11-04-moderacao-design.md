# Moderação mínima

Spec da moderação decidida em D43: precisa existir antes do lançamento público. O autor seguiu sem perguntas; o escopo vem de D18, D24, D43 e PRD RF07 §2 e §4.4. O que veio do Claude está em §7.

## 1. Por quê

O Vértice é self-service: qualquer pessoa da UNIFEI publica sem aprovação prévia. Sem moderação, spam ou informação falsa só sai do ar por SQL manual seguido de reconstrução do índice de busca.

## 2. Objetivos

- Qualquer usuário logado denuncia um processo ou projeto.
- Com 5 denúncias distintas e pendentes, o alvo sai do ar sozinho (D18) e os administradores recebem e-mail.
- O `SYSTEM_ADMIN` vê a fila de denúncias, oculta ou restaura qualquer projeto ou processo com motivo, e tudo vai para `audit_logs`.
- Ocultar e restaurar atualizam busca e vocabulário automaticamente.

## 3. Fora do escopo

Métricas, edição de projeto pelo admin, transferência de dono, selo de verificado, gestão de tags e de usuários e tela de `audit_logs`.

## 4. Anti-objetivos

- Alvo oculto aparecendo na vitrine, na busca, no corretor, nos carrosséis, na página do projeto ou em link de "Minhas candidaturas".
- Quem denuncia descobrindo quem mais denunciou ou quantas denúncias existem.
- Uma pessoa sozinha tirando um alvo do ar por denúncias repetidas.
- Ação de moderação sem motivo ou sem registro.

## 5. Comportamento

**Estados.**
- Projeto oculto pelo admin fica `SUSPENDED`.
- Projeto oculto por denúncias fica `UNDER_REVIEW`.
- Processo oculto, pelo admin ou por denúncias, fica `UNDER_REVIEW`. O enum de processo não tem `SUSPENDED`, e a interface chama esse estado de "Oculto pela moderação".
- O estado anterior é guardado em `status_before_moderation`, e restaurar volta a ele.

**Denunciar.**
- O botão "Denunciar" fica na página do processo e na do projeto, só para quem está logado e não é membro do projeto.
- O diálogo tem motivo (Spam, Informação falsa, Conteúdo impróprio, Outro) e descrição opcional de até 500 caracteres.
- A confirmação é sempre "Recebemos sua denúncia.", inclusive quando a denúncia é repetida.
- Limite de 10 denúncias por dia por usuário.

**Automático.** Na 5ª denúncia pendente de usuários distintos, o alvo visível vai para `UNDER_REVIEW` na mesma transação da denúncia, e todos os `SYSTEM_ADMIN` da instituição recebem e-mail depois do commit. Um alvo já oculto continua recebendo denúncias, sem mudar de estado.

**Admin, em `/admin`.**
- Fila de alvos com denúncias pendentes, mais denunciados primeiro, com tipo, nome, estado, número de denúncias e motivos.
- Busca de projeto ou processo pelo nome.
- Ações:
  - **Ocultar:** motivo obrigatório, de 10 a 500 caracteres.
  - **Restaurar:** motivo obrigatório; resolve as denúncias pendentes daquele alvo.
  - **Descartar denúncias:** resolve sem mudar o estado.
- Toda ação grava `audit_logs` com motivo, estado anterior e estado novo.

**Efeitos.**
- Ocultar ou restaurar atualiza os documentos de busca do alvo (todos os processos, no caso de projeto) e agenda a reconstrução do vocabulário depois do commit.
- Membros veem no painel do projeto "Oculto pela moderação", com o motivo da última ação, e o projeto fica só leitura, como já ocorre com estado não `ACTIVE`.
- Em "Minhas candidaturas", o título de processo ou projeto oculto aparece sem link.

**Logs.** Os pontos restantes que passam o objeto de erro ao `console.error` passam a registrar só nome e código: telemetria, rota do edital, busca e indexação.

## 6. Aceite

1. Cinco usuários diferentes denunciam e o processo some da vitrine, da busca e do corretor; o admin recebe e-mail.
2. O mesmo usuário denunciando cinco vezes não oculta nada.
3. O admin oculta um projeto com motivo e o projeto e seus processos somem; restaurar volta ao estado anterior, inclusive `ARCHIVED`.
4. Não admin recebe 404 em `/admin` e nas ações, com registro (D24).
5. Ações de moderação aparecem em `audit_logs`.
6. `pnpm lint`, `pnpm tsc --noEmit`, `pnpm test`, `pnpm test:e2e`, `pnpm build` passam.

## 7. Decisões do Claude (revisar)

- Processo oculto pelo admin reusa `UNDER_REVIEW`, para evitar mudar enum.
- Denúncia exige login; membro não denuncia o próprio projeto.
- A resposta "Recebemos sua denúncia." é igual sempre, sem revelar repetição.
- 10 denúncias por dia por usuário.
- Restaurar resolve as denúncias pendentes, e novas denúncias começam do zero.
- Motivo de 10 a 500 caracteres; os membros veem o motivo.
- E-mail a todos os `SYSTEM_ADMIN` da instituição, só ao atingir o limite.

## 8. Temas em aberto

- Quem denunciou pode ver o resultado? Hoje não.
- `SYSTEM_ADMIN` ainda não vê candidatos de projeto denunciado.
- Recurso do dono do projeto: hoje é por e-mail fora do sistema.
