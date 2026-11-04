import { Link, Text } from "@react-email/components";
import { EmailLayout, linkStyle, paragraph } from "./layout";

export type ApplicationReceivedProps = {
  studentName: string;
  opportunityTitle: string;
  projectName: string;
  url: string;
};

export function ApplicationReceivedEmail({
  studentName,
  opportunityTitle,
  projectName,
  url,
}: ApplicationReceivedProps) {
  return (
    <EmailLayout preview={`Recebemos a sua candidatura a ${opportunityTitle}`}>
      <Text style={paragraph}>Olá, {studentName}.</Text>
      <Text style={paragraph}>
        Recebemos a sua candidatura a <strong>{opportunityTitle}</strong>, do projeto {projectName}. A equipe do projeto
        vai avaliá-la, e cada mudança de etapa chega por e-mail.
      </Text>
      <Text style={paragraph}>
        Acompanhe em{" "}
        <Link href={url} style={linkStyle}>
          Minhas candidaturas
        </Link>
        .
      </Text>
    </EmailLayout>
  );
}
