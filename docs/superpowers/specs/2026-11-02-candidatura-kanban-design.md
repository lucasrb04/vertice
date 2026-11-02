# Candidatura + Kanban

Spec do subprojeto de seleção pela plataforma. O autor seguiu sem responder às perguntas de descoberta, então vale o que está em PRD RF05 e RF06, D34, D40 e D41. O que veio do Claude está em §8.

## 1. Por quê

As equipes da UNIFEI controlam o processo seletivo cada uma do seu jeito. O projeto que quiser pode usar o Vértice para receber candidatos e acompanhar cada um até o resultado. Quem segue só pelo edital continua igual e não exige conta de ninguém (D40).

## 2. Objetivos

- O projeto liga a seleção pela plataforma num processo e escreve a pergunta opcional.
- O aluno se candidata em poucos passos, sabendo o que será compartilhado.
- A equipe vê os candidatos por etapa, move um ou vários e escreve uma mensagem.
- O aluno acompanha etapa e mensagens em "Minhas candidaturas" e recebe e-mail.

## 3. Fora do escopo

- Match e `matchScoreSnapshot` calculado.
- Onboarding completo e perfil profundo.
- "Já me inscrevi neste edital" e lembretes de prazo.
- Aviso por e-mail à equipe a cada candidatura: o painel do projeto mostra a contagem.
- Desistência da candidatura (§9).

## 4. Anti-objetivos

- Candidato visível para quem não é membro do projeto, inclusive `SYSTEM_ADMIN` sem membership e rotas públicas.
- Aluno vendo observação ou candidatos de outros alunos.
- Candidatura antes da abertura (D41), depois do prazo ou em projeto arquivado.
- Falha de e-mail desfazendo uma candidatura ou movimentação.

## 5. Aluno

**Botão.** A página do processo mostra "Candidatar-se" quando `internalSelectionEnabled` é verdadeiro e o processo está aberto, ao lado de "Acessar edital" se houver. Antes da abertura aparece desabilitado, com "Candidaturas abrem em dd/mm". Quem já se candidatou vê "Ver minha candidatura".

**Login.** Sem sessão, vai para `/entrar?next=/processo/<slug>/candidatar` e volta depois do Google. `next` só aceita caminho interno: começa com `/`, não com `//` nem `/\`.

**Candidatar.** Em `/processo/[slug]/candidatar`, uma página só:
1. Perfil curto: curso e período obrigatórios, um link opcional (LinkedIn, GitHub, Lattes ou portfólio, https). Vem preenchido se já existir, e salvar atualiza `student_profiles`.
2. Resposta à `customQuestion`, se houver: obrigatória, até 1000 caracteres.
3. Aviso: "A equipe do projeto verá seu nome, e-mail, curso, período, link e resposta."

Requisitos como período mínimo aparecem como aviso, sem bloquear: quem decide é a equipe.

**Recusas no servidor, com mensagem clara:** processo não aberto ou sem seleção pela plataforma, abertura futura, candidatura repetida (`applications_opp_user_idx`), aluno membro do projeto, 20 candidaturas por hora por usuário (D22).

**Minhas candidaturas.** Em `/minhas-candidaturas`: processo, projeto, etapa atual e mensagens recebidas, da mais recente para a mais antiga. O painel linka para ela.

## 6. Equipe

**Formulário do processo.** A opção deixa de ser "Em breve". Ligada, mostra `customQuestion` (até 280 caracteres, opcional). Não pode ser desligada se já houver candidaturas.

**Kanban.** Em `/projetos/[projectId]/processos/[opportunityId]/candidatos`, cinco colunas: Inscrito, Em análise, Entrevista, Aprovado, Não selecionado. No celular as colunas viram lista. Card: nome, curso, período e data. Abrir mostra e-mail, link, resposta e histórico.

**Mover.** Cada card tem checkbox e "Mover para". A ação abre um diálogo com mensagem opcional, até 2000 caracteres, e vale para um ou até 50 selecionados. Sem arrastar nesta versão.

**Regras.**
- OWNER, ADMIN e REVIEWER veem e movem. Membership real é obrigatória.
- Projeto arquivado: só leitura. Processo encerrado continua movendo, porque a seleção ocorre depois do prazo.
- Qualquer etapa pode ir para qualquer outra, inclusive voltar.
- Cada movimento grava `application_events` e atualiza `updatedByUserId`.
- Se outra pessoa moveu antes, a etapa enviada não confere e aquele candidato não muda; o retorno informa quantos foram movidos.

## 7. E-mail

Resend + React Email. Dois modelos: confirmação de candidatura e mudança de etapa, com a mensagem. Envio depois do commit, em `after()`. Falha é registrada sem dados do aluno e não afeta a operação; a mensagem segue em "Minhas candidaturas". Sem `RESEND_API_KEY` fora de produção, só registra que enviaria. Em produção `RESEND_API_KEY` e `EMAIL_FROM` são obrigatórios.

## 8. Decisões do Claude (revisar)

- Sem arrastar: "Mover para" funciona com teclado e celular e dispensa dependência. Arrastar pode vir depois.
- `matchScoreSnapshot` passa a aceitar nulo: gravar 0 pareceria um score real.
- Perfil curto com só um link.
- Requisitos avisam, não bloqueiam.
- Membro do projeto não se candidata ao próprio processo.
- Mover processo encerrado é permitido.
- Sem aviso por e-mail à equipe.
- Limite de 50 por movimento em lote.

## 9. Temas em aberto

- Desistência da candidatura e exclusão dos dados dela (LGPD): falta decidir.
- Por quanto tempo guardar candidaturas de processos encerrados (LGPD).
- Domínio remetente do Resend: precisa de conta e DNS do autor.
- `SYSTEM_ADMIN` sem membership não vê candidatos; moderação pode exigir revisão disso.

## 10. Aceite

1. Aluno sem conta chega ao processo, entra e se candidata; a confirmação é registrada.
2. Segunda candidatura ao mesmo processo é recusada.
3. Antes da abertura e depois do prazo, a candidatura é recusada no servidor.
4. Não membro recebe 404 no Kanban e nas ações, sem revelar a existência.
5. REVIEWER move em lote com mensagem; o aluno vê a etapa e a mensagem.
6. Movimento concorrente não sobrescreve.
7. Falha do envio de e-mail não desfaz nada.
8. `pnpm lint`, `pnpm tsc --noEmit`, `pnpm test`, `pnpm test:e2e`, `pnpm build` passam.
