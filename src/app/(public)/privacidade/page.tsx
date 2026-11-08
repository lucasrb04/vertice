import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidade — Vértice",
  description: "Quais dados o Vértice coleta, para quê, com quem compartilha e como exercer seus direitos (LGPD).",
};

const CONTROLLER = "Lucas Ribeiro Barbosa";
const CONTACT_EMAIL = "privacidade@verticehub.online";
const UPDATED_AT = "8 de novembro de 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 border-t border-stone-200 pt-8 first-of-type:mt-8">
      <h2 className="font-heading text-xl font-semibold tracking-tight text-stone-900">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-stone-700">{children}</div>
    </section>
  );
}

function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 marker:text-stone-400">
      {items.map((item, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: lista estática, a ordem nunca muda
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

const ContactLink = () => (
  <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-brand underline-offset-4 hover:underline">
    {CONTACT_EMAIL}
  </a>
);

export default function PrivacidadePage() {
  return (
    <div className="bg-stone-50 px-4 py-12">
      <article className="mx-auto max-w-3xl rounded-md border border-stone-200 bg-white p-6 sm:p-10">
        <p className="font-mono text-xs tracking-wide text-stone-500 uppercase">Atualizada em {UPDATED_AT}</p>
        <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-stone-900">Política de Privacidade</h1>
        <p className="mt-4 leading-relaxed text-stone-700">
          Esta política explica quais dados pessoais o Vértice trata, para quê, com quem eles são compartilhados e como
          você exerce seus direitos, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018, a LGPD).
        </p>

        <Section title="Quem somos">
          <p>
            O Vértice é uma plataforma de código aberto para divulgar vagas, iniciações científicas, projetos de
            extensão e projetos especiais da UNIFEI, Campus Itajubá. O responsável pelo tratamento dos dados
            (controlador) é {CONTROLLER}, mantenedor do projeto, que atende pelo e-mail <ContactLink />.
          </p>
        </Section>

        <Section title="Dados que coletamos">
          <List
            items={[
              <>
                <strong>Conta Google:</strong> nome, e-mail institucional (@unifei.edu.br) e foto, recebidos do Google
                quando você entra. Também guardamos os tokens que o Google devolve no login. Não temos acesso à sua
                senha.
              </>,
              <>
                <strong>Perfil:</strong> curso, semestre, áreas de interesse, preferência por bolsa, habilidades,
                apresentação e links (GitHub, LinkedIn, Lattes, portfólio), tudo preenchido por você.
              </>,
              <>
                <strong>Candidaturas:</strong> os processos em que você se inscreve, suas respostas, o link de perfil
                que você enviar, a compatibilidade calculada no momento da inscrição e o histórico de status e mensagens
                dos organizadores.
              </>,
              <>
                <strong>Projetos e processos que você publica</strong>, e as denúncias que você fizer.
              </>,
              <>
                <strong>Segurança:</strong> endereço IP e navegador da sua sessão, o IP associado a ações
                administrativas e de moderação, e o registro de acessos do servidor (IP, página pedida, navegador e
                horário), usado para investigar erros e abusos.
              </>,
              <>
                <strong>Visitantes sem login:</strong> para contar acessos a editais sem duplicar, guardamos um código
                gerado a partir do IP e do navegador com uma chave secreta. O IP em si não é armazenado. As buscas são
                registradas só como termos agregados, sem identificar quem buscou.
              </>,
            ]}
          />
        </Section>

        <Section title="Para que usamos e com que base legal">
          <List
            items={[
              <>
                Criar sua conta, mostrar processos compatíveis com seu perfil, registrar candidaturas e avisar sobre
                mudanças de status por e-mail: <strong>execução do serviço que você solicitou</strong> (art. 7º, V).
              </>,
              <>
                Limitar abusos, impedir bots, investigar denúncias e manter registros de auditoria:{" "}
                <strong>legítimo interesse</strong> na segurança da plataforma e dos usuários (art. 7º, IX).
              </>,
            ]}
          />
          <p>Não vendemos dados, não exibimos publicidade e não usamos ferramentas de rastreamento ou análise.</p>
        </Section>

        <Section title="Quem vê seus dados">
          <List
            items={[
              <>
                <strong>Sua candidatura</strong> só é vista por você e pelos membros autorizados do projeto responsável
                pelo processo. Ela nunca aparece nas páginas públicas.
              </>,
              <>
                <strong>Administradores do Vértice</strong> acessam o necessário para moderação e segurança.
              </>,
              <>
                <strong>Serviços que operam a plataforma</strong> (operadores), apenas para a função de cada um:
              </>,
            ]}
          />
          <List
            items={[
              <>
                <strong>Google</strong>: login com a conta institucional.
              </>,
              <>
                <strong>Oracle Cloud</strong>: hospedagem do site e do banco de dados, em São Paulo (Brasil).
              </>,
              <>
                <strong>Resend</strong>: envio dos e-mails de candidatura (recebe seu nome, e-mail e o conteúdo da
                mensagem).
              </>,
              <>
                <strong>Cloudflare</strong>: DNS do domínio e o Turnstile, verificação anti-robô na criação de projetos,
                que analisa sinais técnicos do navegador.
              </>,
            ]}
          />
          <p>
            Alguns desses serviços podem processar dados fora do Brasil. Nesses casos, a transferência segue o art. 33
            da LGPD, com as garantias contratuais oferecidas por cada operador.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            Usamos apenas o cookie de sessão necessário para manter você conectado. Não há cookies de publicidade ou de
            análise.
          </p>
        </Section>

        <Section title="Por quanto tempo guardamos">
          <p>
            Seus dados ficam guardados enquanto sua conta existir. Quando você pede a exclusão, apagamos a conta, o
            perfil e as candidaturas; as cópias de segurança do banco são sobrescritas em até 7 dias. Registros de
            auditoria podem ser mantidos pelo tempo necessário para apurar incidentes de segurança, sem vínculo com uma
            conta apagada. O registro de acessos e os logs técnicos do servidor são apagados automaticamente após 14
            dias.
          </p>
        </Section>

        <Section title="Seus direitos">
          <p>Pela LGPD (art. 18), você pode, a qualquer momento:</p>
          <List
            items={[
              "confirmar se tratamos seus dados e ter acesso a eles;",
              "corrigir dados incompletos, inexatos ou desatualizados (a maior parte direto no seu perfil);",
              "pedir a anonimização, o bloqueio ou a eliminação de dados desnecessários;",
              "pedir a portabilidade dos seus dados;",
              "pedir a exclusão da sua conta e dos dados associados;",
              "saber com quem compartilhamos seus dados;",
              "se opor a um tratamento feito com base no legítimo interesse.",
            ]}
          />
          <p>
            Para exercer qualquer um deles, escreva para <ContactLink /> a partir do seu e-mail institucional.
            Respondemos em até 15 dias. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
          </p>
        </Section>

        <Section title="Segurança">
          <p>
            O acesso é feito só por HTTPS, o login exige conta Google institucional, e cada ação sobre projetos e
            candidaturas é conferida contra as permissões de quem a pede. Nenhum sistema é infalível: se houver um
            incidente que possa trazer risco a você, avisaremos os afetados e a ANPD.
          </p>
        </Section>

        <Section title="Mudanças nesta política">
          <p>
            Quando esta política mudar, a data no topo é atualizada. Mudanças relevantes são avisadas no site antes de
            valer.
          </p>
        </Section>
      </article>
    </div>
  );
}
