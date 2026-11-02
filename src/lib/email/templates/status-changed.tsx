import { Link, Text } from "@react-email/components";
import { EmailLayout, linkStyle, paragraph } from "./layout";

export type StatusChangedProps = {
  studentName: string;
  opportunityTitle: string;
  projectName: string;
  statusLabel: string;
  message: string | null;
  url: string;
};

export function StatusChangedEmail({
  studentName,
  opportunityTitle,
  projectName,
  statusLabel,
  message,
  url,
}: StatusChangedProps) {
  return (
    <EmailLayout preview={`Sua candidatura a ${opportunityTitle} está em: ${statusLabel}`}>
      <Text style={paragraph}>Olá, {studentName}.</Text>
      <Text style={paragraph}>
        A sua candidatura a <strong>{opportunityTitle}</strong>, do projeto {projectName}, mudou de etapa:{" "}
        <strong>{statusLabel}</strong>.
      </Text>
      {message ? (
        <>
          <Text style={{ ...paragraph, margin: "0 0 4px", color: "#78716c" }}>Mensagem da equipe:</Text>
          <Text style={{ ...paragraph, whiteSpace: "pre-wrap", borderLeft: "2px solid #e7e5e4", paddingLeft: "12px" }}>
            {message}
          </Text>
        </>
      ) : null}
      <Text style={paragraph}>
        O histórico completo está em{" "}
        <Link href={url} style={linkStyle}>
          Minhas candidaturas
        </Link>
        .
      </Text>
    </EmailLayout>
  );
}
