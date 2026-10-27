# Product Requirements Document (PRD) — Vértice (MVP UNIFEI)

> **Decisões consolidadas:** divergências entre este PRD e os demais documentos foram resolvidas em [`DECISIONS.md`](DECISIONS.md), que prevalece em caso de conflito.
>
> **Nota sobre o Nome do Produto:** *Vértice* é utilizado neste documento como codinome oficial do MVP. Opções candidatas para decisão final:
> 1. **Vértice** (Ponto de encontro entre linhas/trajetórias; remete à engenharia, exatas e conexão).
> 2. **Nexo** (Curto, forte, foca na conexão direta entre alunos e projetos).
> 3. **Órbita** (Ideia de gravitar em torno dos projetos, laboratórios e equipes da universidade).
> 4. **Vetor** (Linguagem nativa da UNIFEI; representa direção, sentido e magnitude na carreira do aluno).
> 5. **Pulso** (Remete à timeline viva do que está acontecendo no campus em tempo real).

---

## 1. Visão Geral do Produto

### 1.1. O Problema
Na **UNIFEI (Campus Itajubá)** e nas universidades brasileiras em geral, o ecossistema de **Iniciação Científica (IC)**, **Projetos de Extensão**, **Projetos Especiais (Equipes de Competição)**, **PETs**, **Laboratórios** e **Empresas Juniores** sofre com a descentralização na divulgação de vagas. As oportunidades ficam pulverizadas em e-mails institucionais pouco lidos, stories de Instagram isolados ou dependem do "boca a boca" e indicação direta de professores. Isso gera dois problemas graves:
1. **Para os alunos:** Dificuldade em descobrir oportunidades alinhadas aos seus interesses e às habilidades que desejam desenvolver, especialmente nos primeiros anos de curso.
2. **Para os projetos e orientadores:** Baixa diversidade de candidatos (bolha de divulgação) e alto esforço operacional para divulgar editais e gerenciar processos seletivos em planilhas improvisadas.

### 1.2. A Solução
Uma plataforma web centralizada, de **baixíssima fricção de adoção** e **operação autônoma (zero aprovação prévia manual)**, onde:
* Qualquer visitante visualiza uma **Timeline Pública** de vagas abertas na UNIFEI, com busca textual rápida, filtros combinados e tags abertas.
* Alunos cadastrados contam com um **Algoritmo de Recomendação e Afinidade** que cruza seus interesses, o que já sabem e **o que querem aprender** com as oportunidades disponíveis, exibindo o percentual de compatibilidade e a justificativa (*Explainable Match*).
* Líderes de projetos e professores publicam vagas em menos de 2 minutos, escolhendo entre **Triagem Interna na Plataforma (Kanban de 4 etapas)** ou **Redirecionamento Direto para Edital/Link Externo** (sem exigir login do aluno para acessar o link externo).
* O administrador do sistema dispõe de um **Portal de Admin e Auditoria (`/admin`)** para acompanhar métricas, moderar conteúdos sob demanda, higienizar/mesclar tags criadas pelos usuários e intervir em casos de suporte ou segurança.

### 1.3. Escopo Institucional (Single-Tenant no Frontend, Multi-Tenant no Backend)
* **Frontend:** 100% focado na realidade da **UNIFEI — Campus Itajubá** (cursos de graduação da UNIFEI, institutos como IESTI, IMC, IRN, IEPG, IFQ, etc., e modalidades locais como Projetos Especiais, PIBIC/FAPEMIG/CNPq, CEX, PET). Não haverá seletor de universidade visível ao usuário no MVP.
* **Backend e Banco de Dados:** Arquitetura preparada desde o dia zero para múltiplas instituições através da entidade `institutions` e chave estrangeira `institution_id` em todas as tabelas de domínio, resolvida automaticamente via variável de ambiente `DEFAULT_INSTITUTION_SLUG="unifei-itajuba"`.

---

## 2. Atores, Papéis (RBAC) e Controle de Acesso

Para permitir que um mesmo aluno veterano seja simultaneamente **candidato a uma IC** e **líder/recrutador de uma Equipe de Competição**, o sistema adota um modelo de permissão em duas camadas:

### 2.1. Papel Global (`users.system_role`)
1. **Visitante (Anônimo):**
   * Navega pela Timeline Pública, utiliza busca por palavras-chave, filtros e tags.
   * Visualiza páginas de detalhes de projetos e vagas.
   * Clica em links de **Editais/Formulários Externos** diretamente sem necessidade de criar conta.
2. **`USER` (Usuário Autenticado — Aluno / Professor / Líder):**
   * Preenche seu perfil de interesses/competências e recebe recomendações personalizadas ($0\%$ a $100\%$).
   * Candidata-se a vagas com **Triagem Interna** em 1 clique.
   * Pode criar novos Projetos (desde que tenha **e-mail verificado**) ou ser convidado para gerenciar projetos existentes.
3. **`SYSTEM_ADMIN` (Administrador da Plataforma):**
   * Acesso exclusivo ao **Portal de Admin (`/admin`)** para observabilidade, auditoria de segurança, moderação reativa de projetos/vagas/usuários e governança de tags.

### 2.2. Papel por Projeto (`project_members.role`)
Dentro de cada projeto cadastrado, os membros gestores possuem um dos seguintes papéis:
* **`OWNER` (Criador / Coordenador / Capitão):** Controle total sobre o projeto, edição de dados institucionais, gestão de membros da equipe recrutadora, criação/encerramento de vagas e triagem de candidatos.
* **`ADMIN` (Diretor / Co-orientador):** Pode editar o projeto, criar/editar vagas e gerenciar candidatos.
* **`REVIEWER` (Avaliador / Membro de RH do Projeto):** Pode visualizar os candidatos inscritos nas vagas do projeto e movimentar seus status no Kanban de seleção, sem permissão para excluir o projeto.

### 2.3. Acesso Restrito ao Domínio Institucional (D31)
* **Somente e-mails `@unifei.edu.br` podem criar conta e fazer login.** A validação é feita no servidor contra os domínios permitidos da instituição (`institutions.allowed_email_domains`).
* Projetos podem informar qualquer e-mail de contato público (ex: Gmail da equipe).
* O selo de verificação de projeto é concedido manualmente pelo `SYSTEM_ADMIN` (projeto oficial/verificado).

---

## 3. Requisitos Funcionais (RF)

### RF01 — Vitrine Pública, Busca Textual, Filtros e Tags Abertas
1. **Timeline de Oportunidades:**
   * Listagem paginada (ou *infinite scroll* leve) de vagas abertas.
   * Ordenação selecionável:
     * *Para Visitantes:* "Mais recentes", "Prazo encerrando em breve", "Mais populares".
     * *Para Usuários Logados:* **"Maior Compatibilidade (Match %)"** (padrão), "Mais recentes", "Prazo encerrando em breve".
2. **Motor de Busca e Filtros Combináveis:**
   * **Busca por Palavra-Chave (`Full-Text + Trigram Search`):** Busca pelo título da vaga, nome do projeto, nome do professor/orientador, descrição e tags (tolerante a acentos e pequenos erros de digitação via extensões `unaccent` e `pg_trgm` do PostgreSQL).
   * **Filtros Rápidos:**
     * Modalidade: *Iniciação Científica (IC)*, *Projeto Especial (Competição)*, *Extensão*, *PET*, *Empresa Júnior*, *Laboratório / P&D*.
     * Remuneração/Bolsa: *Com Bolsa Remunerada*, *Voluntário*, *A definir*.
     * Tipo de Inscrição: *Inscrição Rápida (Pela Plataforma)*, *Edital Externo*.
     * Curso Elegível e Tags específicas.
3. **Sistema de Tags Abertas com Normalização:**
   * Ao cadastrar ou editar uma vaga, o líder do projeto pode selecionar tags existentes em um *Combobox* com busca instantânea **ou criar uma nova tag na hora** simplesmente digitando e pressionando `Enter`.
   * **Regra de Higienização Automática:** Ao criar uma tag, o backend gera um `slug` normalizado (minúsculo, sem acentos, sem caracteres especiais extras, ex: `"React.js"` e `"react js"` $\rightarrow$ verificam colisão por similaridade/slug) para evitar duplicatas triviais e manter a eficácia do algoritmo de recomendação.

### RF02 — Onboarding Rápido e Perfil Profundo do Aluno
1. **Onboarding em 3 Passos (< 60 segundos após primeiro login):**
   * **Passo 1 (Contexto Acadêmico):** Curso na UNIFEI, Ano/Período de ingresso e modalidades de projeto que procura (*IC, Extensão, Equipe de Competição, etc.*).
   * **Passo 2 (Áreas de Interesse & Bolsa):** Seleção de macro-áreas temáticas (ex: *Inteligência Artificial, Energias Renováveis, Robótica, Aeroespacial, Gestão & Finanças, Desenvolvimento de Software, Materiais, Educação*) e preferência por bolsa (*Indiferente / Priorizo bolsa remunerada*).
   * **Passo 3 (Matriz de Habilidades — "Já sei" vs. "Quero aprender"):** Seleção de tags técnicas e interpessoais divididas em duas colunas claras:
     * **Já tenho contato (`KNOWN`):** Habilidades que o aluno já domina ou estudou.
     * **Quero desenvolver (`WANT_TO_LEARN`):** Habilidades que o aluno busca aprender ao entrar em um projeto.
2. **Perfil Profundo (*Deep Profile* — Opcional, pós-onboarding):**
   * O usuário vê um indicador de completude do perfil (ex: `Perfil 65% completo — Complete para refinar seu Match`).
   * Campos adicionais que enriquecem o algoritmo e servem de "currículo" nas candidaturas internas:
     * Nível de proficiência nas habilidades que já possui ($1 = \text{Básico}$, $2 = \text{Intermediário}$, $3 = \text{Avançado}$).
     * Objetivo principal na universidade (*Seguir carreira acadêmica/Mestrado* `ACADEMIC`, *Preparação prática para o mercado* `INDUSTRY`, *Impacto social e extensão* `IMPACT`, *Liderança e gestão* `LEADERSHIP`, *Ainda explorando* `EXPLORING`). No MVP, este campo compõe o perfil/currículo, mas **não** entra no cálculo do score (D11).
     * Mini-bio (até $500$ caracteres) e links externos validados (*Currículo Lattes, GitHub, LinkedIn, Portfólio*).

### RF03 — Algoritmo de Recomendação e Afinidade (*Content-Based Multi-Criteria Match*)
O sistema calcula o score de afinidade $A(u, v) \in [0, 100]$ entre o estudante $u$ e a vaga $v$. O cálculo é feito em memória a cada requisição por uma função pura (sem cache persistente no MVP); o score é congelado em `applications.match_score_snapshot` no momento da candidatura.

$$A(u, v) = \text{round}\left( \Phi_{\text{eleg}} \cdot \left( 0.35 \, S_{\text{tema}} + 0.45 \, S_{\text{hab}} + 0.20 \, S_{\text{ctx}} \right) \times 100 \right)$$

A especificação matemática completa e normativa está em [`ARCHITECTURE.md §5`](ARCHITECTURE.md). Em termos de produto:

1. **Afinidade Temática ($35\%$):** quanto os interesses e habilidades do aluno cobrem os temas da vaga, sem penalizar quem tem perfil amplo.
2. **Sinergia de Competências ($45\%$):**
   * **Fit de Aprendizado ($25\%$):** cruza o que o aluno marcou em **"Quero aprender"** com o que a vaga ensina (*Recompensa de Crescimento*).
   * **Fit Técnico ($20\%$):** cruza o que o aluno **"Já sabe"** com as habilidades desejáveis da vaga, ponderado pela proficiência (Iniciante $0.7$, Intermediário $0.9$, Avançado $1.0$).
   * Se a vaga não define habilidades desejáveis, todo o peso vai para o Fit de Aprendizado.
3. **Contexto e Modalidade ($20\%$):** categoria do projeto entre as preferidas do aluno ($50\%$) e bolsa ($50\%$; vale $0.25$ se o aluno prefere bolsa remunerada e a vaga é só voluntária).
4. **Fator de Elegibilidade:** $\Phi = 1.0$ se a vaga é aberta a todos ou inclui o curso do aluno; $\Phi = 0.45$ caso contrário, com aviso claro de restrição de curso.
5. **Faixas:** **Alto $\ge 80\%$** (badge esmeralda e elegível ao *Match Digest*), Médio $\ge 50\%$, Baixo $< 50\%$.
6. **Explicabilidade no Frontend (*Explainable Match*):**
   * Todo card de vaga exibe a badge de compatibilidade (ex: `92% compatível`) acompanhada de até 3 motivos gerados deterministicamente pelo motor (ex: *"Ensina Modelagem 3D e Python, que você quer aprender"*, *"Compatível com seu interesse em Robótica"*).

### RF04 — Cadastro "Ultra-Low Friction" de Projetos e Vagas
1. **Fluxo Unificado (Projeto + 1ª Vaga na mesma jornada):**
   * Se o usuário clica em *"Publicar Vaga"* e ainda não administra nenhum projeto, o sistema apresenta um formulário enxuto de 2 passos:
     * **Passo 1 — Sobre o Projeto:** Nome, Sigla (opcional), Categoria (*IC / Laboratório*, *Projeto Especial*, *Extensão*, *PET*, *Empresa Júnior*), Instituto/Departamento vinculado (opcional), Descrição curta e Links (Instagram, Site, E-mail de contato).
     * **Passo 2 — Sobre a Vaga:** Título da vaga, Descrição das atividades, Modalidade de Bolsa (*Voluntário*, *PIBIC/CNPq*, *FAPEMIG*, *Bolsa Institucional/Externa*) + Valor (opcional), Carga Horária Semanal estimada ($4\text{h}$ a $20\text{h}$), Prazo final de inscrição, Cursos elegíveis (*Todos* ou seleção específica), Tags (*Desejáveis* e *O que o aluno vai aprender*) e **Modo de Inscrição**.
2. **Presets por Categoria:**
   * Selecionar *Iniciação Científica* pré-configura sugestões de bolsas (*PIBIC, FAPEMIG, Voluntário*) e campo de Professor Orientador.
   * Selecionar *Projeto Especial / Equipe* sugere subáreas comuns (*Elétrica, Mecânica, Software, Gestão, Marketing*).

### RF05 — Fluxo Híbrido de Candidatura e Triagem (Kanban vs. Link Externo)
Na criação da vaga, o responsável escolhe entre dois modos de captação:

1. **Modo A — Triagem Interna pela Plataforma (`INTERNAL`):**
   * O aluno logado clica em *"Candidatar-se"*, revisa os dados do seu perfil que serão compartilhados com o projeto e responde a uma pergunta aberta configurável pelo projeto (ex: *"Por que você tem interesse nesta vaga?"*, máx. $1000$ caracteres).
   * **Painel do Projeto (Kanban / Lista de Inscritos):** Os gestores do projeto visualizam os candidatos em 4 colunas/status:
     1. `APPLIED` (*Inscrito*)
     2. `IN_REVIEW` (*Em Análise*)
     3. `INTERVIEW` (*Entrevista / Dinâmica*)
     4. `ACCEPTED` (*Aprovado*) / `REJECTED` (*Não selecionado*)
   * Ao mover o card de um candidato (ou selecionar múltiplos candidatos em lote), o gestor pode escrever uma **mensagem personalizada** (ex: link do Google Meet e horário da entrevista, ou feedback final) que é enviada por e-mail ao aluno e registrada no histórico da candidatura (tabela `application_events`).
2. **Modo B — Redirecionamento para Edital/Formulário Externo (`EXTERNAL`):**
   * O botão principal da vaga exibe *"Acessar Edital / Inscrever-se Externamente"*.
   * **Acesso livre sem login:** Qualquer visitante pode clicar e ser redirecionado imediatamente para o link externo (PDF do edital, SIGAA, Google Forms, etc.).
   * **Telemetria para o Projeto:** O clique passa por um endpoint/action de redirecionamento ou beacon que incrementa o contador de **Cliques no Edital** daquela vaga (deduplicado por visitante/dia via hash HMAC de IP + User-Agent; o IP bruto nunca é armazenado).
   * Se o aluno estiver logado, ele pode marcar o botão *"Já me inscrevi neste edital"* para salvar a vaga na sua aba *"Minhas Candidaturas"* e receber lembretes de prazo.

### RF06 — Sistema de E-mails Transacionais e Alertas de Match
Integrado via **Resend + React Email**, com templates limpos e responsivos:
1. **Verificação de Conta e Autenticação:** Link mágico / código de verificação de e-mail e recuperação de senha.
2. **Confirmação de Candidatura:** E-mail para o aluno confirmando a inscrição interna + resumo diário ou notificação imediata para o responsável da vaga.
3. **Atualização de Status do Processo Seletivo:** Disparo imediato quando o projeto altera o status do candidato no Kanban interno (incluindo a mensagem customizada do avaliador).
4. **Alerta de Novas Vagas com Alto Match (*Match Digest*):**
   * Sempre que uma nova vaga é publicada (processado de forma assíncrona/background ou via Cron Job), alunos que optaram por receber alertas (`email_match_alerts = true`) e possuem afinidade $A(u, v) \ge 80\%$ recebem um e-mail personalizado destacando a vaga e os motivos do match.
   * Todos os e-mails não-transacionais possuem link de *One-Click Unsubscribe* (`List-Unsubscribe` header).

### RF07 — Portal de Administração, Auditoria e Curadoria Reativa (`/admin`)
Embora a plataforma opere no modelo *Self-Service* (sem fila de aprovação prévia), o usuário com papel `SYSTEM_ADMIN` dispõe de um painel administrativo protegido para governança, suporte e auditoria:

1. **Dashboard de Observabilidade:**
   * KPIs em tempo real: Total de alunos cadastrados (e % com perfil completo), Projetos ativos por categoria, Vagas abertas vs. encerradas, Total de candidaturas internas + Cliques em editais externos, e taxa de entrega/falha de e-mails.
2. **Gestão e Intervenção em Projetos e Vagas:**
   * Listagem completa com busca e filtros por status (`ACTIVE`, `SUSPENDED`, `ARCHIVED`).
   * **Ações de Suporte:** Editar dados de qualquer projeto/vaga (ex: corrigir um link quebrado a pedido de um professor), alterar ou **transferir a propriedade (`OWNER`)** de um projeto para outro usuário (muito comum na troca anual de diretoria/capitania de Projetos Especiais e EJs), e conceder/revogar manualmente o selo de projeto verificado.
   * **Moderação Reativa (Kill-Switch):** Suspender/ocultar imediatamente um projeto ou vaga em caso de spam, conteúdo impróprio ou informação falsa, registrando o motivo no log de auditoria.
3. **Governança e Higienização de Tags Abertas (*Tag Management*):**
   * Visualização de todas as tags do sistema com contagem de uso (quantos alunos e quantas vagas utilizam cada tag) e filtro de *"Tags criadas recentemente pelos usuários"*.
   * **Ferramenta de Merge (Fusão de Tags Duplicadas):** Permite selecionar uma tag duplicada/com erro de digitação (ex: `"Pyhton"` ou `"ReactJS"`) e mesclá-la em uma tag canônica (`"Python"` ou `"React"`), atualizando em uma única transação do banco todas as referências em perfis de alunos e vagas, e criando um *alias* para evitar que o erro se repita.
   * Edição de nome/categoria da tag ou exclusão de tags ofensivas/irrelevantes.
4. **Gestão de Usuários e Trilha de Auditoria (`Audit Logs`):**
   * Busca de usuários por nome/e-mail, visualização de papéis, verificação manual de conta e botão de **Banimento/Suspensão (`is_banned`)** que invalida todas as sessões ativas do usuário na hora.
   * Visualização da tabela `audit_logs` com registro imutável de ações críticas (criação/exclusão de projetos, alterações de permissão, ações de admin, alertas de rate-limit excedido) contendo `actor_id`, `action`, `target_type`, `target_id`, `metadata` (JSONB), `ip_address` e `created_at`.

---

## 4. Requisitos Não-Funcionais e Blindagem de Segurança ("À Prova de Alunos de TI")

Por ser uma plataforma utilizada em uma universidade com forte presença de cursos de Computação e Engenharia, o sistema deve seguir práticas rigorosas de *Security by Design*:

1. **Prevenção contra IDOR e Escalação de Privilégios:**
   * **Proibido o uso de IDs numéricos sequenciais** (`1, 2, 3`) em rotas ou payloads. Todas as entidades utilizam **UUID (v4)** gerado pelo banco; URLs públicas usam `slug`.
   * Toda *Server Action* e *Route Handler* de mutação deve invocar obrigatoriamente um *guard* de autorização no servidor (`requireProjectRole(projectId, ['OWNER', 'ADMIN'])` ou `requireSystemAdmin()`) que valida a sessão diretamente no banco de dados antes de executar qualquer query.
2. **Validação Estrita de Inputs e Prevenção de XSS / Open Redirect:**
   * Todos os dados recebidos pelo servidor passam por schemas **Zod** com limites estritos de tamanho (`max()`).
   * Links externos de editais, GitHub, Lattes e redes sociais passam por um validador de URL que **aceita exclusivamente o protocolo `https:`** (bloqueando na raiz vetores como `javascript:`, `data:` ou `vbscript:`).
   * Textos descritivos de projetos e vagas não aceitam HTML arbitrário; utiliza-se texto puro estruturado ou Markdown restrito e sanitizado no servidor.
3. **Proteção Anti-Bot, Anti-Spam e Rate Limiting:**
   * **Cloudflare Turnstile** (desafio invisível) obrigatório nas telas de Cadastro, Login, Recuperação de Senha e Criação de Projeto.
   * **Rate Limiting em Camadas:** Implementado no backend por IP e por `user_id` (ex: máximo de 3 projetos criados por usuário por dia; máximo de 20 candidaturas por hora; limite de requisições na busca e no disparo de e-mails de verificação).
4. **Botão de "Denunciar Vaga/Projeto" na Comunidade:**
   * Qualquer usuário logado pode reportar uma vaga ou projeto suspeito (uma denúncia por usuário por alvo). Ao atingir $5$ denúncias distintas, o alvo entra automaticamente no status `UNDER_REVIEW`, deixa de aparecer na timeline e dispara um alerta por e-mail para o `SYSTEM_ADMIN`.
5. **Isolamento de Dados de Candidatos (LGPD & Privacidade):**
   * As rotas públicas da Timeline e da Vaga **jamais** retornam dados de quem se candidatou. Apenas os membros autorizados do projeto (`OWNER`, `ADMIN`, `REVIEWER`) e o próprio aluno têm acesso aos dados da candidatura.

---

## 5. Diretrizes de UI/UX e Identidade Visual ("Anti-Cara de IA")

Para garantir credibilidade imediata entre alunos e professores e fugir completamente da estética genérica de templates gerados por IA:

* **Proibições Visuais Estritas:**
  * Zero fundos escuros com gradientes roxo/magenta/ciano neon.
  * Zero textos com gradiente (`bg-clip-text`) em títulos genéricos.
  * Zero ilustrações abstratas 3D ou ícones de foguete/robô/brilho (`sparkles`) espalhados pela interface.
* **Direção Estética — Editorial / Acadêmico Contemporâneo (Inspiração: *Linear*, *Read.cv*, *Vercel Geist*):**
  * **Paleta de Cores:** Fundo principal claro e levemente aquecido (`stone-50` / `#FAFAF9`), cards em branco puro (`#FFFFFF`) com bordas finas e precisas (`1px solid #E7E5E4` / `stone-200`), texto principal em grafite profundo (`#1C1917` / `stone-900`).
  * **Cor de Destaque Institucional:** Azul profundo sóbrio (`#0F3D75` — remetendo à tradição da UNIFEI com modernidade) combinado com Verde Esmeralda discreto (`#059669`) para indicadores de alto Match ($\ge 80\%$) e Âmbar (`#D97706`) para prazos prestes a encerrar.
  * **Tipografia com Personalidade:**
    * *Títulos e Cabeçalhos:* **Plus Jakarta Sans** (tracking levemente negativo `-0.02em`, peso `600`/`700`).
    * *Corpo de Texto:* **Inter** (foco total em legibilidade).
    * *Metadados, Badges de Match, Prazos e Valores de Bolsa:* **JetBrains Mono** (fonte monoespaçada que confere aspecto técnico, preciso e de engenharia aos cards das vagas).
  * **Design dos Cards na Timeline:** Layout denso, escaneável e informativo. Em vez de cards gigantes e vazios, cada card mostra claramente: Nome do Projeto + Selo de Categoria, Título da Vaga, Tags principais (diferenciando o que pede vs. o que ensina), Modalidade de Bolsa, Prazo restante e o Badge de `% Match` com tooltip explicativo.

---

## 6. Fora do Escopo do MVP (Out of Scope)

Para garantir uma entrega rápida, estável e enxuta para o TCC, os seguintes itens **não** farão parte do MVP:
1. Chat em tempo real dentro da plataforma entre alunos e coordenadores (a comunicação ocorre via mensagens de mudança de status enviadas por e-mail ou pelos canais oficiais do projeto).
2. Upload e armazenamento de arquivos pesados em PDF (currículos ou editais em PDF); o sistema trabalhará com o Perfil Estruturado do aluno + Links validados (Lattes, GitHub, LinkedIn, Google Drive/ Docs institucionais).
3. Testes técnicos automatizados ou vídeo-entrevistas gravadas dentro da plataforma.
4. Integração direta via API privada com o SIGAA da UNIFEI (para evitar burocracia administrativa com a STI da universidade que atrasaria o TCC).
5. Seletor público de outras universidades no frontend (embora o banco já suporte `institution_id`).